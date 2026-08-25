const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  tallyLedgerName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Index for quick queries by Tally Ledger and Mobile
CustomerSchema.index({ tallyLedgerName: 1 });
CustomerSchema.index({ mobile: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);
