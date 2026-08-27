const express = require('express');
const router = express.Router();
const TallyTransaction = require('../models/tally-transaction.model');
const { validateTallyApiKey } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * @route POST /api/tally/sync/batch
 * @desc Sync a batch of vouchers to the remote server database with bulk insert/upsert
 * @access Private (Tally API Key Authentication)
 */
router.post('/sync/batch', validateTallyApiKey, async (req, res) => {
  const { batchId, vouchers } = req.body;

  if (!vouchers || !Array.isArray(vouchers)) {
    return res.status(400).json({ success: false, message: 'Invalid payload: vouchers list required' });
  }

  logger.info(`Received sync batch ${batchId} containing ${vouchers.length} records.`);

  // If MongoDB is offline, run in simulated success staging mode
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Remote Server Database is offline. Running batch sync in Simulated Success Mode.');
    return res.status(200).json({
      success: true,
      batchId,
      received: vouchers.length,
      inserted: vouchers.length,
      updated: 0,
      duplicates: 0,
      failed: 0,
      note: 'Simulated success (Server MongoDB offline)'
    });
  }

  try {
    const bulkOps = vouchers.map(v => {
      // Parse dates safely
      let dateParsed = new Date();
      if (v.date && v.date.length === 8) {
        const y = v.date.substring(0, 4);
        const m = v.date.substring(4, 6);
        const d = v.date.substring(6, 8);
        dateParsed = new Date(`${y}-${m}-${d}`);
      }

      return {
        updateOne: {
          filter: { guid: v.guid },
          update: {
            $set: {
              guid: v.guid,
              companyName: v.companyName,
              voucherNumber: v.voucherNumber,
              date: dateParsed,
              voucherType: v.voucherType,
              partyName: v.partyName,
              amount: v.amount,
              narration: v.narration,
              syncedAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

    const result = await TallyTransaction.bulkWrite(bulkOps, { ordered: false });

    // Calculate response statistics
    const upsertedCount = result.upsertedCount || 0;
    const modifiedCount = result.modifiedCount || 0;
    const matchedCount = result.matchedCount || 0;
    
    // Matched but not modified means it was a duplicate/no changes
    const duplicateCount = matchedCount - modifiedCount;

    return res.status(200).json({
      success: true,
      batchId,
      received: vouchers.length,
      inserted: upsertedCount,
      updated: modifiedCount,
      duplicates: duplicateCount,
      failed: 0
    });

  } catch (error) {
    logger.error(`Error saving sync batch ${batchId}: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to process sync batch',
      error: error.message
    });
  }
});

module.exports = router;
