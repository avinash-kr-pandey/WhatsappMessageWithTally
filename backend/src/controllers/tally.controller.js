const invoiceService = require('../services/invoice.service');
const customerService = require('../services/customer.service');
const { whatsappQueue } = require('../queue/whatsapp.queue');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Handle incoming Tally Sales Invoice Created POST Hook
 */
const handleTallyInvoiceHook = async (req, res, next) => {
  try {
    const payload = req.validatedBody;
    const { company, invoice } = payload;

    // 1. Generate unique idempotency key
    const idempotencyKey = invoiceService.generateIdempotencyKey(
      company.name,
      invoice.voucherNumber,
      invoice.date
    );

    logger.info(`Received Tally webhook for Invoice: ${invoice.voucherNumber}, Idempotency: ${idempotencyKey}`);

    // 2. Check duplicate invoice check
    const existingInvoice = await invoiceService.getInvoiceByIdempotencyKey(idempotencyKey);
    if (existingInvoice) {
      logger.warn(`Duplicate invoice detected: ${invoice.voucherNumber} for company ${company.name}. Skipping processing.`);
      return successResponse(res, 'Invoice processed successfully (Duplicate request ignored)', {
        idempotencyKey,
        status: existingInvoice.status,
        whatsappStatus: existingInvoice.whatsappStatus
      });
    }

    // 3. Upsert Customer details database record
    await customerService.upsertCustomer(
      invoice.partyName,
      invoice.mobile,
      company.name
    );

    // 4. Create new Invoice entry
    const savedInvoice = await invoiceService.createInvoice(payload, idempotencyKey);

    // 5. Enqueue background WhatsApp messaging job using BullMQ
    const job = await whatsappQueue.add('send-whatsapp', {
      invoiceData: savedInvoice,
      idempotencyKey
    });

    // Update status in db to reflect queued state
    await invoiceService.updateInvoiceStatus(idempotencyKey, { status: 'QUEUED' });

    logger.info(`Enqueued WhatsApp job ${job.id} for Invoice: ${invoice.voucherNumber}`);

    // 6. Return response IMMEDIATELY to prevent blocking TallyPrime UI thread
    return successResponse(res, 'Invoice received successfully', {
      idempotencyKey,
      jobId: job.id
    }, 201);

  } catch (error) {
    logger.error('Failed processing Tally invoice webhook:', error);
    next(error);
  }
};

module.exports = {
  handleTallyInvoiceHook
};
