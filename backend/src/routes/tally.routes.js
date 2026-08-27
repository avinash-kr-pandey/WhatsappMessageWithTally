const express = require('express');
const { 
  handleTallyInvoiceHook, 
  getRecentSalesVouchers, 
  handleManualWhatsAppSend,
  handleImportSampleData
} = require('../controllers/tally.controller');
const { validateTallyApiKey } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validation.middleware');
const { tallyInvoiceSchema } = require('../validators/tally.validator');

const syncController = require('../controllers/sync.controller');

const router = express.Router();

/**
 * @route POST /api/tally/invoice
 * @desc Receive Sales Invoice from TallyPrime
 * @access Private (Tally API Key Authentication)
 */
router.post('/invoice', validateTallyApiKey, validateBody(tallyInvoiceSchema), handleTallyInvoiceHook);

/**
 * @route GET /api/tally/vouchers
 * @desc Retrieve recent sales vouchers from local TallyPrime instance
 * @access Public (For local Web Dashboard UI dashboard)
 */
router.get('/vouchers', getRecentSalesVouchers);

/**
 * @route POST /api/tally/import-sample
 * @desc Push sample data (ledgers, vouchers) directly into active Tally company
 * @access Public
 */
router.post('/import-sample', handleImportSampleData);

/**
 * @route POST /api/tally/send-manual
 * @desc Manually trigger WhatsApp notification for an invoice
 * @access Public
 */
router.post('/send-manual', handleManualWhatsAppSend);

// Sync control routes
router.post('/sync/start', syncController.startSync);
router.post('/sync/pause', syncController.pauseSync);
router.post('/sync/resume', syncController.resumeSync);
router.post('/sync/stop', syncController.stopSync);
router.get('/sync/status', syncController.getSyncStatus);
router.get('/sync/transactions', syncController.getTransactions);
router.get('/sync/errors', syncController.getSyncErrors);
router.post('/sync/retry-failed', syncController.retryFailedSync);
router.post('/sync/config', syncController.updateConfig);

module.exports = router;

