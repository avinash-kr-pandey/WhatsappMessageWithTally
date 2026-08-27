const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');

// Auto import worker to launch BullMQ worker process on application boot
require('./queue/whatsapp.worker');

const startServer = async () => {
  try {
    // Start Express Webhook Engine
    const server = app.listen(config.port, () => {
      logger.info(`===================================================`);
      logger.info(` TALLY + WHATSAPP CONNECTOR RUNNING ON PORT: ${config.port} `);
      logger.info(` Environment: ${config.env} `);
      logger.info(`===================================================`);
    });

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
