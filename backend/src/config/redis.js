const { Queue, Worker } = require('bullmq');
const config = require('./env');
const logger = require('../utils/logger');

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port
};

logger.info(`Redis configured at ${redisConnection.host}:${redisConnection.port}`);

module.exports = {
  redisConnection
};
