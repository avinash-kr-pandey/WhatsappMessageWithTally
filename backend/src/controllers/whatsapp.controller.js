const config = require('../config/env');
const whatsappService = require('../services/whatsapp.service');
const tallyService = require('../services/tally.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * WhatsApp Webhook Verification Endpoint (GET method)
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Meta Webhook verified successfully!');
    return res.status(200).send(challenge);
  } else {
    logger.warn('Meta Webhook validation failed: verification token mismatch.');
    return res.status(403).send('Forbidden');
  }
};

/**
 * Handle incoming events from WhatsApp Webhook (POST method)
 * Handles delivery statuses, read tracking, and customer command keywords (Two-Way flow)
 */
const handleWebhookEvent = async (req, res, next) => {
  try {
    const { entry } = req.validatedBody;
    if (!entry || entry.length === 0) {
      return successResponse(res, 'No events found');
    }

    const value = entry[0].changes[0].value;

    // A. Handle Status Updates (sent, delivered, read, failed)
    if (value.statuses && value.statuses.length > 0) {
      for (const statusObj of value.statuses) {
        const { id: messageId, status, recipient_id } = statusObj;
        logger.info(`Received WhatsApp Message Status Update. Message ID: ${messageId}, Status: ${status}`);
      }
    }

    // B. Handle Customer Inbound Message (Two-way integration commands)
    if (value.messages && value.messages.length > 0) {
      for (const msg of value.messages) {
        const from = msg.from; // Sender Mobile Number
        const messageId = msg.id;
        
        if (msg.type === 'text') {
          const body = msg.text.body.trim().toLowerCase();
          logger.info(`Received customer message from: ${from}. Message text: "${body}"`);

          // Resolve Commands Layer: "balance", "statement", "invoice", "last invoice", "payment"
          await handleTwoWayCommand(from, body);
        }
      }
    }

    return successResponse(res, 'Webhook event processed');
  } catch (error) {
    logger.error('WhatsApp Hook Handler Failed:', error);
    next(error);
  }
};

/**
 * Action executor for incoming user commands to bridge dynamic queries with TallyPrime
 */
const handleTwoWayCommand = async (fromMobile, commandText) => {
  try {
    // 1. Resolve Ledger Name directly from Tally
    const customer = await tallyService.getLedgerByMobile(fromMobile);

    if (!customer) {
      logger.warn(`Received command from unregistered mobile: ${fromMobile}. Ignoring.`);
      await whatsappService.sendTextMessage(
        fromMobile,
        `Hello! Your mobile number is not linked to any client ledger record in Tally. Please contact support to register.`
      );
      return;
    }

    const ledgerName = customer.tallyLedgerName;
    logger.info(`Processing command: "${commandText}" for Tally Ledger Name: "${ledgerName}"`);

    // 2. Controlled Routing Logic
    switch (commandText) {
      case 'balance': {
        const tallyResponse = await tallyService.getLedgerBalance(ledgerName);
        // Safely try to parse the XML result object
        let balanceString = 'Not found';
        try {
          // Fallback parsing structure for standard Ledger queries
          balanceString = tallyResponse.ENVELOPE.BODY.DATA.COLLECTION.LEDGER.SVCURRENTBALANCE || '₹0.00';
        } catch (e) {
          balanceString = '₹0.00 (Outstanding)';
        }
        await whatsappService.sendTextMessage(
          fromMobile,
          `Dear ${customer.name},\nYour current ledger balance is: *${balanceString}*.\nThank you!`
        );
        break;
      }

      case 'outstanding':
      case 'statement': {
        const tallyResponse = await tallyService.getOutstandingAmount(ledgerName);
        await whatsappService.sendTextMessage(
          fromMobile,
          `Dear ${customer.name},\nWe are processing your outstanding statement. Please check back in a few minutes.`
        );
        break;
      }

      case 'last invoice':
      case 'invoice': {
        const tallyResponse = await tallyService.getLastInvoices(ledgerName, 1);
        let invNo = null;
        let invDate = null;
        let invAmt = null;

        try {
          if (tallyResponse && tallyResponse.ENVELOPE && tallyResponse.ENVELOPE.BODY && tallyResponse.ENVELOPE.BODY.DATA && tallyResponse.ENVELOPE.BODY.DATA.COLLECTION) {
            const collection = tallyResponse.ENVELOPE.BODY.DATA.COLLECTION;
            if (collection.VOUCHER) {
              const voucher = Array.isArray(collection.VOUCHER) ? collection.VOUCHER[0] : collection.VOUCHER;
              invNo = voucher.VOUCHERNUMBER || (voucher.$ && voucher.$.VOUCHERNUMBER);
              invDate = voucher.DATE || (voucher.$ && voucher.$.DATE);
              invAmt = voucher.AMOUNT || (voucher.$ && voucher.$.AMOUNT);
            }
          }
        } catch (e) {
          logger.error(`Error parsing last invoice XML: ${e.message}`);
        }

        if (invNo) {
          await whatsappService.sendTextMessage(
            fromMobile,
            `Hello!\nYour last Invoice details:\nInvoice No: *${invNo}*\nDate: *${invDate}*\nTotal Amount: *₹${invAmt}*`
          );
        } else {
          await whatsappService.sendTextMessage(fromMobile, `Hi ${customer.name}, we couldn't find any invoice records in Tally.`);
        }
        break;
      }

      default: {
        // Helpful options menu command callback
        const helpText = `Hello ${customer.name}!\nAvailable Options:\n- *balance* : Get ledger balance\n- *invoice* : Get last invoice status\n- *statement* : Fetch ledger outstanding`;
        await whatsappService.sendTextMessage(fromMobile, helpText);
        break;
      }
    }
  } catch (error) {
    logger.error(`Error resolving WhatsApp Two-Way command flow: ${error.message}`);
    await whatsappService.sendTextMessage(fromMobile, `Sorry, we experienced an issue retrieving your data from our systems.`);
  }
};

module.exports = {
  verifyWebhook,
  handleWebhookEvent
};
