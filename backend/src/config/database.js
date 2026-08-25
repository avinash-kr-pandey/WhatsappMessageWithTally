const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./env');

const connectDatabase = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB database successfully.');
  } catch (error) {
    logger.error('Failed to connect to MongoDB database:', error);
    process.exit(1);
  }
};

module.exports = { connectDatabase };
