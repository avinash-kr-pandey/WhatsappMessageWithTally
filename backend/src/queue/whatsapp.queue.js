const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const logger = require('../utils/logger');

const WHATSAPP_QUEUE_NAME = 'whatsapp-invoice-queue';

const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: parseInt(process.env.MAX_RETRIES) || 3,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.BACKOFF_DELAY) || 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

logger.info(`Initialized WhatsApp BullMQ Queue: ${WHATSAPP_QUEUE_NAME}`);

module.exports = {
  whatsappQueue,
  WHATSAPP_QUEUE_NAME
};
