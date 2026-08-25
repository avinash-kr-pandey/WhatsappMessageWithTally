const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  amount: { type: Number, required: true }
});

const InvoiceSchema = new mongoose.Schema({
  voucherNumber: {
    type: String,
    required: true,
    trim: true
  },
  voucherDate: {
    type: Date,
    required: true
  },
  partyName: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  companyGSTIN: {
    type: String,
    trim: true
  },
  companyAddress: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  items: [ItemSchema],
  status: {
    type: String,
    enum: ['PENDING', 'QUEUED', 'PROCESSED', 'FAILED'],
    default: 'PENDING'
  },
  whatsappStatus: {
    type: String,
    enum: ['UNSENT', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
    default: 'UNSENT'
  },
  whatsappMessageId: {
    type: String,
    trim: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

// Single index for Idempotency validation and search
InvoiceSchema.index({ idempotencyKey: 1 });
InvoiceSchema.index({ whatsappMessageId: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
