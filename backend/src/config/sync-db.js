const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dbPath = path.join(__dirname, '../../tally_sync.db');

let db;
try {
  db = new DatabaseSync(dbPath);
  logger.info(`Local SQLite Database initialized at ${dbPath}`);
  
  // Create tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      guid TEXT PRIMARY KEY,
      master_id INTEGER,
      alter_id INTEGER,
      date TEXT,
      voucher_number TEXT,
      voucher_type TEXT,
      party_name TEXT,
      amount REAL,
      narration TEXT,
      sync_status TEXT DEFAULT 'PENDING',
      error_message TEXT,
      last_sync_attempt TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_checkpoints (
      company_name TEXT PRIMARY KEY,
      last_master_id INTEGER DEFAULT 0,
      last_alter_id INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Set default settings if not already present
  const checkSettings = db.prepare("SELECT COUNT(*) as count FROM sync_settings");
  const countResult = checkSettings.get();
  if (countResult.count === 0) {
    const insertSetting = db.prepare("INSERT INTO sync_settings (key, value) VALUES (?, ?)");
    insertSetting.run('sync_state', 'STOPPED'); // STOPPED, RUNNING, PAUSED
    insertSetting.run('batch_size', '1000');
    insertSetting.run('delay_ms', '200');
    insertSetting.run('max_concurrent_requests', '1');
    insertSetting.run('timeout_ms', '5000');
    insertSetting.run('total_tally_records', '0');
  }

} catch (error) {
  logger.error('Failed to initialize SQLite database:', error);
  throw error;
}

module.exports = db;
