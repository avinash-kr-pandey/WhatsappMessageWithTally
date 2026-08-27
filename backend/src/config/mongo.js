const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./env');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tally_integration';

let isConnected = false;

const connectDb = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000 // fail fast if offline
    });
    isConnected = true;
    logger.info('Connected to remote server database (MongoDB)');
  } catch (error) {
    logger.warn(`Remote Server DB (MongoDB) connection failed: ${error.message}. Running in Local Staging Mode.`);
  }
};

module.exports = { connectDb, mongoose };
