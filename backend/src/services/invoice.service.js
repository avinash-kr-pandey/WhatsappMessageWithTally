const Invoice = require('../models/Invoice');
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
  return await Invoice.findOne({ idempotencyKey: key });
};

/**
 * Create a new invoice record in database
 */
const createInvoice = async (invoiceData, idempotencyKey) => {
  const newInvoice = new Invoice({
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
  });

  return await newInvoice.save();
};

module.exports = {
  generateIdempotencyKey,
  getInvoiceByIdempotencyKey,
  createInvoice
};
