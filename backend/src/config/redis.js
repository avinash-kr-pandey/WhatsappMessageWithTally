const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null // BullMQ requires this to be null
};

logger.info(`Redis configured at ${redisConnection.host}:${redisConnection.port}`);

const redisClient = new Redis({
  ...redisConnection,
  retryStrategy(times) {
    if (times > 3) {
      logger.warn(`Redis connection failed after ${times} attempts. Bypassing Redis cache/queues.`);
      return null; // stop reconnecting
    }
    return Math.min(times * 200, 1000);
  }
});

redisClient.on('error', (err) => {
  logger.error(`Redis Client Error: ${err.message}`);
});

module.exports = {
  redisConnection,
  redisClient
};

