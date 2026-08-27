const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDb } = require('./config/mongo');

// Auto import worker to launch BullMQ worker process on application boot
require('./queue/whatsapp.worker');

const startServer = async () => {
  try {
    // Connect to database
    await connectDb();

    // Start Express Webhook Engine
    const server = app.listen(config.port, () => {
      logger.info(`===================================================`);
      logger.info(` TALLY + WHATSAPP CONNECTOR RUNNING ON PORT: ${config.port} `);
      logger.info(` Environment: ${config.env} `);
      logger.info(`===================================================`);
    });

    // Auto-resume sync loops if they were running before crash/restart
    const db = require('./config/sync-db');
    const syncStateRow = db.prepare("SELECT value FROM sync_settings WHERE key = 'sync_state'").get();
    if (syncStateRow && syncStateRow.value === 'RUNNING') {
      const tallyExtractor = require('./services/tally-extractor');
      const syncWorker = require('./queue/sync.worker');
      tallyExtractor.start();
      syncWorker.start();
      logger.info('Auto-resumed background Tally synchronization pipeline.');
    }

    // Graceful Shutdown Logic
    const shutdown = async () => {
      logger.info('Shutting down server gracefully...');
      server.close(async () => {
        const whatsappWorker = require('./queue/whatsapp.worker');
        if (whatsappWorker) {
          await whatsappWorker.close();
          logger.info('BullMQ workers shutdown complete.');
        }
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed starting application server:', error);
    process.exit(1);
  }
};

startServer();
