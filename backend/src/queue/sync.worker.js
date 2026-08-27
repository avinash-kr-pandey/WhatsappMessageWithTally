const axios = require('axios');
const db = require('../config/sync-db');
const logger = require('../utils/logger');
const config = require('../config/env');

class SyncWorker {
  constructor() {
    this.timerId = null;
    this.isProcessing = false;
    this.consecutiveFailures = 0;
    this.backoffDelay = 1000; // starts at 1s
    this.serverUrl = `http://127.0.0.1:${config.port}/api/tally/sync/batch`; // upload locally or remote
  }

  // Get current settings
  getSettings() {
    const rows = db.prepare("SELECT key, value FROM sync_settings").all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    return {
      state: settings.sync_state || 'STOPPED',
      batchSize: parseInt(settings.batch_size || '1000', 10),
      delayMs: parseInt(settings.delay_ms || '200', 10),
      timeoutMs: parseInt(settings.timeout_ms || '5000', 10)
    };
  }

  start() {
    this.consecutiveFailures = 0;
    this.backoffDelay = 1000;
    this.triggerNext();
    logger.info('Sync Worker started.');
  }

  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    logger.info('Sync Worker stopped.');
  }

  triggerNext() {
    if (this.timerId) clearTimeout(this.timerId);

    const settings = this.getSettings();
    if (settings.state !== 'RUNNING') return;

    // Use dynamic delay + exponential backoff if server is down/degraded
    const currentDelay = this.consecutiveFailures > 0 ? this.backoffDelay : settings.delayMs;

    this.timerId = setTimeout(async () => {
      if (this.isProcessing) return;
      try {
        this.isProcessing = true;
        await this.processBatch();
      } catch (err) {
        logger.error(`Error in sync worker execution: ${err.message}`);
      } finally {
        this.isProcessing = false;
        this.triggerNext();
      }
    }, currentDelay);
  }

  async processBatch() {
    const settings = this.getSettings();
    
    // 1. Fetch pending vouchers from SQLite database
    const pendingVouchers = db.prepare(`
      SELECT guid, master_id, alter_id, date, voucher_number, voucher_type, party_name, amount, narration
      FROM vouchers
      WHERE sync_status = 'PENDING'
      ORDER BY master_id ASC
      LIMIT ?
    `).all(settings.batchSize);

    if (pendingVouchers.length === 0) {
      // Nothing to sync right now
      return;
    }

    logger.info(`Sync Worker: Attempting to upload ${pendingVouchers.length} records to remote server.`);

    // Prepare payload
    const payload = {
      batchId: `BATCH-${Date.now()}`,
      vouchers: pendingVouchers.map(v => ({
        guid: v.guid,
        companyName: 'Demo Company', // can enrich with companyName if tracked
        voucherNumber: v.voucher_number,
        date: v.date,
        voucherType: v.voucher_type,
        partyName: v.party_name,
        amount: v.amount,
        narration: v.narration
      }))
    };

    try {
      const response = await axios.post(this.serverUrl, payload, {
        headers: { 
          'Content-Type': 'application/json',
          'x-tally-api-key': config.tally.apiKey || 'change_me'
        },
        timeout: settings.timeoutMs
      });

      if (response.data && response.data.success) {
        // Success! Update status to SYNCED
        const guids = pendingVouchers.map(v => v.guid);
        const updateStmt = db.prepare("UPDATE vouchers SET sync_status = 'SYNCED', error_message = NULL WHERE guid = ?");
        
        try {
          db.exec('BEGIN');
          for (const guid of guids) {
            updateStmt.run(guid);
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }

        logger.info(`Sync Worker: Successfully synced ${guids.length} records. BatchId: ${payload.batchId}`);
        
        // Reset failures
        this.consecutiveFailures = 0;
        this.backoffDelay = 1000;
      } else {
        throw new Error(response.data?.message || 'Server returned unsuccessful response');
      }

    } catch (error) {
      this.consecutiveFailures++;
      // Exponential backoff up to 30 seconds
      this.backoffDelay = Math.min(this.backoffDelay * 2, 30000);
      
      const errorMsg = error.response?.data?.message || error.message;
      logger.error(`Sync Worker: Batch upload failed. Failure count: ${this.consecutiveFailures}. Delaying next run by ${this.backoffDelay}ms. Error: ${errorMsg}`);

      // If consecutive failures exceed 5, we mark these vouchers as FAILED and continue (or pause)
      if (this.consecutiveFailures >= 5) {
        const guids = pendingVouchers.map(v => v.guid);
        const failStmt = db.prepare("UPDATE vouchers SET sync_status = 'FAILED', error_message = ?, last_sync_attempt = CURRENT_TIMESTAMP WHERE guid = ?");
        
        try {
          db.exec('BEGIN');
          for (const guid of guids) {
            failStmt.run(errorMsg, guid);
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
        
        logger.warn(`Sync Worker: Too many failures. Marked ${guids.length} vouchers as FAILED.`);
        
        // Reset failures to prevent infinite blocking of the queue
        this.consecutiveFailures = 0;
        this.backoffDelay = 1000;
      }
    }
  }

  // Retry all failed vouchers
  retryFailed() {
    const result = db.prepare("UPDATE vouchers SET sync_status = 'PENDING', error_message = NULL WHERE sync_status = 'FAILED'").run();
    logger.info(`Queued ${result.changes} failed vouchers for retry.`);
    return result.changes;
  }
}

module.exports = new SyncWorker();
