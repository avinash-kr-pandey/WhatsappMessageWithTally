const invoiceService = require('../services/invoice.service');
const customerService = require('../services/customer.service');
const tallyService = require('../services/tally.service');
const { whatsappQueue } = require('../queue/whatsapp.queue');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

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

/**
 * Fetch recent sales vouchers from TallyPrime and enrich with WhatsApp status
 */
const getRecentSalesVouchers = async (req, res, next) => {
  try {
    const vouchers = await tallyService.getRecentSalesInvoices();
    
    const enrichedVouchers = await Promise.all(vouchers.map(async (v) => {
      const cached = await invoiceService.getInvoiceByVoucherNumber(v.voucherNumber);
      return {
        ...v,
        whatsappStatus: cached ? cached.whatsappStatus : 'UNSENT'
      };
    }));

    return successResponse(res, 'Fetched recent vouchers from Tally Prime', enrichedVouchers);
  } catch (error) {
    logger.error('Failed fetching Tally vouchers:', error);
    next(error);
  }
};

/**
 * Handle manually triggered WhatsApp send request from UI
 */
const handleManualWhatsAppSend = async (req, res, next) => {
  try {
    const payload = req.body;
    const { company, invoice, items } = payload;

    if (!company || !invoice || !items) {
      return errorResponse(res, 'Invalid request payload. Must contain company, invoice, and items.', 400);
    }

    // 1. Generate unique idempotency key
    const idempotencyKey = invoiceService.generateIdempotencyKey(
      company.name,
      invoice.voucherNumber,
      invoice.date
    );

    logger.info(`Manual WhatsApp send request for Invoice: ${invoice.voucherNumber}`);

    // 2. Check duplicate invoice check
    const existingInvoice = await invoiceService.getInvoiceByIdempotencyKey(idempotencyKey);
    if (existingInvoice && existingInvoice.status === 'PROCESSED') {
      logger.info(`Re-sending processed invoice: ${invoice.voucherNumber}`);
      await invoiceService.updateInvoiceStatus(idempotencyKey, { status: 'PENDING', whatsappStatus: 'UNSENT' });
    } else if (!existingInvoice) {
      await invoiceService.createInvoice(payload, idempotencyKey);
    }

    // Get up-to-date invoice record
    const savedInvoice = await invoiceService.getInvoiceByIdempotencyKey(idempotencyKey);
    
    // Override mobile number if updated in UI
    if (invoice.mobile) {
      savedInvoice.mobile = invoice.mobile.replace(/[^0-9+]/g, '');
      await invoiceService.updateInvoiceStatus(idempotencyKey, { mobile: savedInvoice.mobile });
    }

    // 3. Enqueue background WhatsApp messaging job using BullMQ
    const job = await whatsappQueue.add('send-whatsapp', {
      invoiceData: savedInvoice,
      idempotencyKey
    });

    await invoiceService.updateInvoiceStatus(idempotencyKey, { status: 'QUEUED' });

    logger.info(`Manual WhatsApp job ${job.id} enqueued for Invoice: ${invoice.voucherNumber}`);

    return successResponse(res, 'WhatsApp job enqueued successfully', {
      idempotencyKey,
      jobId: job.id
    }, 201);

  } catch (error) {
    logger.error('Failed processing manual WhatsApp trigger:', error);
    next(error);
  }
};

/**
 * Push sample data XML to TallyPrime XML HTTP Port directly
 */
const handleImportSampleData = async (req, res, next) => {
  try {
    const xmlPath = path.join(__dirname, '../../public/tally-sample-import.xml');
    if (!fs.existsSync(xmlPath)) {
      return errorResponse(res, 'Sample XML file not found', 404);
    }
    
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    logger.info('Pushing sample XML data directly to TallyPrime...');
    const responseXml = await tallyService.sendXmlRequest(xmlContent);
    
    return successResponse(res, 'Sample data imported to Tally successfully', {
      response: responseXml
    });
  } catch (error) {
    logger.error('Failed to import sample data to Tally:', error);
    next(error);
  }
};

module.exports = {
  handleTallyInvoiceHook,
  getRecentSalesVouchers,
  handleManualWhatsAppSend,
  handleImportSampleData
};
