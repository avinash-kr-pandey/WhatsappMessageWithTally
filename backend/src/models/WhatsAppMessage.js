const mongoose = require('mongoose');

const WhatsAppMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  direction: {
    type: String,
    enum: ['INBOUND', 'OUTBOUND'],
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'document', 'template', 'other'],
    required: true
  },
  message: {
    type: String
  },
  status: {
    type: String,
    enum: ['SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

WhatsAppMessageSchema.index({ messageId: 1 });
WhatsAppMessageSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);
