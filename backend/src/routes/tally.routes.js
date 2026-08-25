const express = require('express');
const { handleTallyInvoiceHook } = require('../controllers/tally.controller');
const { validateTallyApiKey } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validation.middleware');
const { tallyInvoiceSchema } = require('../validators/tally.validator');

const router = express.Router();

/**
 * @route POST /api/tally/invoice
 * @desc Receive Sales Invoice from TallyPrime
 * @access Private (Tally API Key Authentication)
 */
router.post('/invoice', validateTallyApiKey, validateBody(tallyInvoiceSchema), handleTallyInvoiceHook);

module.exports = router;
