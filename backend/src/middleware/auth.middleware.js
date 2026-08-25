const config = require('../config/env');
const { errorResponse } = require('../utils/response');

/**
 * Tally API Key validation middleware
 */
const validateTallyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-tally-api-key'];

  if (!apiKey || apiKey !== config.tally.apiKey) {
    return errorResponse(res, 'Unauthorized - Invalid Tally API Key', { error: 'Invalid API Key' }, 401);
  }

  next();
};

module.exports = {
  validateTallyApiKey
};
