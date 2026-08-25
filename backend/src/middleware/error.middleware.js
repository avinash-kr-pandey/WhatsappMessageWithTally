const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

/**
 * Centeralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`Error processing request at ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(res, message, {
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, statusCode);
};

module.exports = {
  errorHandler
};
