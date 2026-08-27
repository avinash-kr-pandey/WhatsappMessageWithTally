const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('../config/env');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.accessToken = config.whatsapp.accessToken;
    // Set custom app.mis.work WA Endpoint (using correct matching certificate domain)
    this.baseUrl = 'https://app.mis.work/api/v1';
    
    // SSL bypass agent for custom domain compatibility
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  /**
   * Helper to format mobile number to international format with + prefix
   * e.g., converts '09876543210' to '+919876543210'
   */
  normalizePhoneNumber(phone) {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    return '+' + clean;
  }

  /**
   * Log outgoing messages
   */
  async logMessage(messageId, to, type, content, status, direction = 'OUTBOUND', metadata = {}) {
    logger.info(`[WhatsApp Message Log] MessageID: ${messageId} | Direction: ${direction} | To: ${to} | Type: ${type} | Status: ${status} | Message: ${typeof content === 'string' ? content : JSON.stringify(content)}`);
  }

  /**
   * sendPostRequest Wrapper for app.mis.work API
   */
  async sendPostRequest(endpoint, payload) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    if (!this.accessToken || this.accessToken.startsWith('fake_')) {
      const mockId = 'wa_msg_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      logger.info(`[Mock] API Post to ${url}: ${JSON.stringify(payload)}`);
      return {
        messages: [{ id: mockId }]
      };
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'x-api-key': this.accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        httpsAgent: this.httpsAgent
      });
      
      logger.info(`WhatsApp API Response: ${JSON.stringify(response.data)}`);
      
      // Wrap in standard messages array format to maintain controller compatibility
      return {
        messages: [{ id: response.data.id || response.data.messageId || response.data.status || 'success_id' }]
      };
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.error(`app.mis.work API Request Error to ${url}: ${errorMsg}`);
      throw new Error(`WhatsApp API Error: ${errorMsg}`);
    }
  }

  /**
   * 1. Send text message
   */
  async sendTextMessage(to, text) {
    const cleanTo = this.normalizePhoneNumber(to);
    const payload = {
      receiverMobileNo: cleanTo,
      message: [text]
    };

    const res = await this.sendPostRequest('message/create', payload);
    const msgId = res.messages[0].id;
    await this.logMessage(msgId, cleanTo, 'text', text, 'SENT');
    return res;
  }

  /**
   * 2. Send structured WhatsApp Template message (Adapts as plain text message for app.mis.work)
   */
  async sendTemplateMessage(to, templateName, languageCode, components) {
    // Formulate a structured text message since app.mis.work utilizes plain text endpoint
    let text = `Notification Alert: ${templateName}`;
    if (components && components[0] && components[0].parameters) {
      const params = components[0].parameters.map(p => p.text).join('\n- ');
      text += `\nDetails:\n- ${params}`;
    }
    return await this.sendTextMessage(to, text);
  }

  /**
   * 3. Send Invoice Message Orchestrator
   */
  async sendInvoiceMessage(to, invoiceData, pdfPath = null) {
    const cleanTo = this.normalizePhoneNumber(to);
    logger.info(`Initiating WhatsApp invoice notification to: ${cleanTo}`);

    // Construct a beautiful plain text invoice summary message
    const itemsText = invoiceData.items.map(item => `- ${item.name} (${item.quantity} x ₹${item.rate.toFixed(2)})`).join('\n');
    const messageBody = `Dear ${invoiceData.partyName},\n\n` +
      `Your sales invoice has been generated for *${invoiceData.companyName}*.\n\n` +
      `*Invoice details:*\n` +
      `- *Invoice No:* ${invoiceData.voucherNumber}\n` +
      `- *Date:* ${invoiceData.voucherDate.toISOString().split('T')[0]}\n\n` +
      `*Items:*\n${itemsText}\n\n` +
      `- *Subtotal:* ₹${(invoiceData.amount - invoiceData.tax).toFixed(2)}\n` +
      `- *Tax (GST):* ₹${invoiceData.tax.toFixed(2)}\n` +
      `*Grand Total:* *₹${invoiceData.amount.toFixed(2)}*\n\n` +
      `Thank you for your business!`;

    // Send the text message
    return await this.sendTextMessage(cleanTo, messageBody);
  }
}

module.exports = new WhatsAppService();
