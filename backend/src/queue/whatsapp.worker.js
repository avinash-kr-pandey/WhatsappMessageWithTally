const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');
const { WHATSAPP_QUEUE_NAME } = require('./whatsapp.queue');
const whatsappService = require('../services/whatsapp.service');
const Invoice = require('../models/Invoice');
const { generateInvoicePDF } = require('../utils/pdf');
const fs = require('fs');

/**
 * BullMQ Worker processing invoice messaging requests
 */
const whatsappWorker = new Worker(
  WHATSAPP_QUEUE_NAME,
  async (job) => {
    const { invoiceId } = job.data;
    logger.info(`Starting execution of Queue Job ${job.id} for Invoice ID: ${invoiceId}`);

    // 1. Fetch invoice from database
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      logger.error(`[Job ${job.id}] Invoice with ID ${invoiceId} not found in database. Skipping job.`);
      return;
    }

    // Protection for double execution in worker layer
    if (invoice.status === 'PROCESSED') {
      logger.warn(`[Job ${job.id}] Invoice ${invoice.voucherNumber} already processed. Skipping duplicate workflow.`);
      return;
    }

    let pdfPath = null;
    try {
      // 2. Generate the PDF invoice
      pdfPath = await generateInvoicePDF(invoice);

      // 3. Send template + PDF invoice message via WhatsApp API
      const apiResponse = await whatsappService.sendInvoiceMessage(invoice.mobile, invoice, pdfPath);
      const messageId = apiResponse.messages[0].id;

      // 4. Update MongoDB record status to reflect success
      invoice.status = 'PROCESSED';
      invoice.whatsappStatus = 'SENT';
      invoice.whatsappMessageId = messageId;
      await invoice.save();

      logger.info(`[Job ${job.id}] Finished successfully. WhatsApp Message ID: ${messageId}`);
    } catch (error) {
      logger.error(`[Job ${job.id}] Job failed with error: ${error.message}`);
      
      invoice.status = 'FAILED';
      invoice.whatsappStatus = 'FAILED';
      await invoice.save();

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
