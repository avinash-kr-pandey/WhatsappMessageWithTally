const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');
const { WHATSAPP_QUEUE_NAME } = require('./whatsapp.queue');
const whatsappService = require('../services/whatsapp.service');
const invoiceService = require('../services/invoice.service');
const { generateInvoicePDF } = require('../utils/pdf');
const fs = require('fs');

/**
 * BullMQ Worker processing invoice messaging requests
 */
const whatsappWorker = new Worker(
  WHATSAPP_QUEUE_NAME,
  async (job) => {
    const { invoiceData, idempotencyKey } = job.data;
    logger.info(`Starting execution of Queue Job ${job.id} for Invoice: ${invoiceData.voucherNumber}`);

    // Protection for double execution in worker layer
    // Let's re-fetch status from Redis to ensure it wasn't already processed
    const currentInvoice = await invoiceService.getInvoiceByIdempotencyKey(idempotencyKey);
    if (!currentInvoice) {
      logger.error(`[Job ${job.id}] Invoice with idempotencyKey ${idempotencyKey} not found in cache. Skipping job.`);
      return;
    }

    if (currentInvoice.status === 'PROCESSED') {
      logger.warn(`[Job ${job.id}] Invoice ${currentInvoice.voucherNumber} already processed. Skipping duplicate workflow.`);
      return;
    }

    // Ensure voucherDate is a proper Date object for pdf generator
    currentInvoice.voucherDate = new Date(currentInvoice.voucherDate);

    let pdfPath = null;
    try {
      // 2. Generate the PDF invoice
      pdfPath = await generateInvoicePDF(currentInvoice);

      // 3. Send template + PDF invoice message via WhatsApp API
      const apiResponse = await whatsappService.sendInvoiceMessage(currentInvoice.mobile, currentInvoice, pdfPath);
      const messageId = apiResponse.messages[0].id;

      // 4. Update status to reflect success
      await invoiceService.updateInvoiceStatus(idempotencyKey, {
        status: 'PROCESSED',
        whatsappStatus: 'SENT',
        whatsappMessageId: messageId
      });

      logger.info(`[Job ${job.id}] Finished successfully. WhatsApp Message ID: ${messageId}`);
    } catch (error) {
      logger.error(`[Job ${job.id}] Job failed with error: ${error.message}`);
      
      await invoiceService.updateInvoiceStatus(idempotencyKey, {
        status: 'FAILED',
        whatsappStatus: 'FAILED'
      });

      throw error; // Re-throw error to trigger BullMQ retry backoff policies
    } finally {
      // 5. Clean up temporary files
      if (pdfPath && fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          logger.debug(`Cleaned up temporary PDF file: ${pdfPath}`);
        } catch (cleanupError) {
          logger.error(`Failed to clean up temporary PDF path ${pdfPath}: ${cleanupError.message}`);
        }
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 2 // Max parallel active executions
  }
);

// Worker events registration
whatsappWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully!`);
});

whatsappWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed after attempts: ${err.message}`);
});

module.exports = whatsappWorker;
