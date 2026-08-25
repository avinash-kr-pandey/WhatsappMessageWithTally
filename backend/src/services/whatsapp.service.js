const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const config = require('../config/env');
const logger = require('../utils/logger');
const WhatsAppMessage = require('../models/WhatsAppMessage');

class WhatsAppService {
  constructor() {
    this.accessToken = config.whatsapp.accessToken;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.apiVersion = config.whatsapp.apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  /**
   * Helper to format mobile number to international format
   * e.g., converts '09876543210' to '919876543210' (assuming India code is default)
   */
  normalizePhoneNumber(phone) {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (clean.length === 10) {
      clean = '91' + clean; // default Indian prefix
    }
    return clean;
  }

  /**
   * Save outgoing messages to DB
   */
  async logMessage(messageId, to, type, content, status, direction = 'OUTBOUND', metadata = {}) {
    try {
      await WhatsAppMessage.create({
        messageId,
        phoneNumber: to,
        direction,
        type,
        message: typeof content === 'string' ? content : JSON.stringify(content),
        status,
        timestamp: new Date(),
        metadata
      });
    } catch (error) {
      logger.error(`Error logging WhatsApp message in db: ${error.message}`);
    }
  }

  /**
   * Meta API Axios Post Wrapper
   */
  async sendPostRequest(endpoint, payload) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    if (!this.accessToken || this.accessToken.startsWith('fake_')) {
      const mockId = 'wamid.HBgL' + Math.random().toString(36).substring(2, 15).toUpperCase();
      logger.info(`[Mock] API Post to ${url}: ${JSON.stringify(payload)}`);
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: payload.to, wa_id: payload.to }],
        messages: [{ id: mockId }]
      };
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.error(`WhatsApp Cloud API Request Error to ${url}: ${errorMsg}`);
      throw new Error(`WhatsApp API Error: ${errorMsg}`);
    }
  }

  /**
   * 1. Send text message
   */
  async sendTextMessage(to, text) {
    const cleanTo = this.normalizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { body: text }
    };

    const res = await this.sendPostRequest('messages', payload);
    const msgId = res.messages[0].id;
    await this.logMessage(msgId, cleanTo, 'text', text, 'SENT');
    return res;
  }

  /**
   * 2. Send structured WhatsApp Template message
   */
  async sendTemplateMessage(to, templateName, languageCode, components) {
    const cleanTo = this.normalizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components
      }
    };

    const res = await this.sendPostRequest('messages', payload);
    const msgId = res.messages[0].id;
    await this.logMessage(msgId, cleanTo, 'template', `Template: ${templateName}`, 'SENT');
    return res;
  }

  /**
   * 3. Upload media (PDF) to Meta servers and get Media ID
   */
  async uploadMedia(filePath, mimeType = 'application/pdf') {
    const url = `${this.baseUrl}/media`;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', 'document');
    form.append('messaging_product', 'whatsapp');

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.accessToken}`
        },
        timeout: 20000
      });
      logger.info(`Media uploaded successfully. Media ID: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.error(`Failed to upload media to WhatsApp: ${errorMsg}`);
      throw new Error(`Media upload failed: ${errorMsg}`);
    }
  }

  /**
   * 4. Send Document using Media ID
   */
  async sendDocument(to, mediaId, filename) {
    const cleanTo = this.normalizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'document',
      document: {
        id: mediaId,
        filename: filename
      }
    };

    const res = await this.sendPostRequest('messages', payload);
    const msgId = res.messages[0].id;
    await this.logMessage(msgId, cleanTo, 'document', `File: ${filename}`, 'SENT');
    return res;
  }

  /**
   * 5. High-level orchestrator: Sends Template and then optionally uploads + attaches PDF invoice
   */
  async sendInvoiceMessage(to, invoiceData, pdfPath = null) {
    const cleanTo = this.normalizePhoneNumber(to);
    logger.info(`Initiating WhatsApp invoice notification message flow to: ${cleanTo}`);

    // Standard Template parameters
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: invoiceData.partyName },
          { type: 'text', text: invoiceData.voucherNumber },
          { type: 'text', text: invoiceData.companyName },
          { type: 'text', text: String(invoiceData.amount) }
        ]
      }
    ];

    // Step 1: Send the Template message
    const templateRes = await this.sendTemplateMessage(
      cleanTo,
      config.whatsapp.templateName,
      config.whatsapp.templateLanguage,
      components
    );

    // Step 2: Upload and send PDF invoice if provided
    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        const mediaId = await this.uploadMedia(pdfPath);
        await this.sendDocument(cleanTo, mediaId, `Invoice_${invoiceData.voucherNumber}.pdf`);
      } catch (err) {
        logger.error(`Error uploading or sending PDF Invoice document: ${err.message}`);
        // Do not crash the entire flow if the PDF attachment fails after template success
      }
    }

    return templateRes;
  }
}

module.exports = new WhatsAppService();
