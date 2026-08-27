const { redisClient } = require('../config/redis');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate a consistent MD5 idempotency key
 */
const generateIdempotencyKey = (companyName, voucherNumber, voucherDate) => {
  const input = `${companyName.trim()}_${voucherNumber.trim()}_${new Date(voucherDate).toISOString().split('T')[0]}`;
  return crypto.createHash('md5').update(input).digest('hex');
};

/**
 * Check if an invoice with a duplicate idempotency key exists
 */
const getInvoiceByIdempotencyKey = async (key) => {
  try {
    const data = await redisClient.get(`idempotency:${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error fetching idempotency key from Redis: ${error.message}`);
    return null;
  }
};

/**
 * Create a new invoice record in Redis database
 */
const createInvoice = async (invoiceData, idempotencyKey) => {
  const invoice = {
    voucherNumber: invoiceData.invoice.voucherNumber,
    voucherDate: new Date(invoiceData.invoice.date),
    partyName: invoiceData.invoice.partyName,
    mobile: invoiceData.invoice.mobile.replace(/[^0-9+]/g, ''),
    companyName: invoiceData.company.name,
    companyGSTIN: invoiceData.company.gstin,
    companyAddress: invoiceData.company.address,
    amount: invoiceData.invoice.total,
    tax: invoiceData.invoice.tax || 0,
    items: invoiceData.items,
    idempotencyKey,
    status: 'PENDING',
    whatsappStatus: 'UNSENT'
  };

  try {
    // Cache for 7 days
    await redisClient.setex(`idempotency:${idempotencyKey}`, 604800, JSON.stringify(invoice));
    await redisClient.setex(`vouchermap:${invoice.voucherNumber}`, 604800, idempotencyKey);
  } catch (error) {
    logger.error(`Error saving invoice to Redis: ${error.message}`);
  }

  return invoice;
};

/**
 * Retrieve invoice status using voucher number mapping
 */
const getInvoiceByVoucherNumber = async (voucherNumber) => {
  try {
    const key = await redisClient.get(`vouchermap:${voucherNumber}`);
    if (key) {
      return await getInvoiceByIdempotencyKey(key);
    }
  } catch (error) {
    logger.error(`Error fetching voucher mapping from Redis: ${error.message}`);
  }
  return null;
};

/**
 * Update status of an invoice in Redis
 */
const updateInvoiceStatus = async (idempotencyKey, updates) => {
  try {
    const invoice = await getInvoiceByIdempotencyKey(idempotencyKey);
    if (invoice) {
      Object.assign(invoice, updates);
      // Keep existing TTL or reset to 7 days
      await redisClient.setex(`idempotency:${idempotencyKey}`, 604800, JSON.stringify(invoice));
      return invoice;
    }
  } catch (error) {
    logger.error(`Error updating invoice status in Redis: ${error.message}`);
  }
  return null;
};

module.exports = {
  generateIdempotencyKey,
  getInvoiceByIdempotencyKey,
  createInvoice,
  getInvoiceByVoucherNumber,
  updateInvoiceStatus
};
