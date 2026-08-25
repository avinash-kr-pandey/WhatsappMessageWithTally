const joi = require('joi');

const tallyInvoiceSchema = joi.object({
  event: joi.string().valid('SALES_INVOICE_CREATED').required(),
  company: joi.object({
    name: joi.string().required(),
    gstin: joi.string().allow('', null),
    address: joi.string().allow('', null)
  }).required(),
  invoice: joi.object({
    voucherNumber: joi.string().required(),
    date: joi.string().isoDate().required(),
    partyName: joi.string().required(),
    mobile: joi.string().pattern(/^[0-9+ ]{10,15}$/).required(),
    subtotal: joi.number().required(),
    tax: joi.number().default(0),
    total: joi.number().required()
  }).required(),
  items: joi.array().items(
    joi.object({
      name: joi.string().required(),
      quantity: joi.number().positive().required(),
      rate: joi.number().min(0).required(),
      discount: joi.number().default(0),
      gst: joi.number().default(0),
      amount: joi.number().required()
    })
  ).min(1).required()
});

module.exports = {
  tallyInvoiceSchema
};
