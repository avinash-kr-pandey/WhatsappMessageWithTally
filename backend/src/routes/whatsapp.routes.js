const express = require('express');
const { verifyWebhook, handleWebhookEvent } = require('../controllers/whatsapp.controller');
const { validateBody } = require('../middleware/validation.middleware');
const { whatsappWebhookSchema } = require('../validators/whatsapp.validator');

const router = express.Router();

/**
 * @route GET /api/whatsapp/webhook
 * @desc Verify Meta Webhook Verification Token configuration
 * @access Public
 */
router.get('/webhook', verifyWebhook);

/**
 * @route POST /api/whatsapp/webhook
 * @desc Receive incoming message updates and status logs from WhatsApp Cloud API
 * @access Public (Requires Meta signature verification for production readiness)
 */
router.post('/webhook', validateBody(whatsappWebhookSchema), handleWebhookEvent);

module.exports = router;
