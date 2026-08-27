const mongoose = require('mongoose');

const TallyTransactionSchema = new mongoose.Schema({
  guid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyName: {
    type: String,
    required: true
  },
  voucherNumber: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true
  },
  voucherType: {
    type: String,
    required: true
  },
  partyName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  narration: {
    type: String,
    default: ''
  },
  syncedAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid compile error on duplicate loading
module.exports = mongoose.models.TallyTransaction || mongoose.model('TallyTransaction', TallyTransactionSchema);
