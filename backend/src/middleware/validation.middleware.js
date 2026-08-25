const { errorResponse } = require('../utils/response');

/**
 * Validates request body against a Joi schema
 * @param {Object} schema Joi Schema
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    
    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path
      }));
      return errorResponse(res, 'Validation error failed', { errors: details }, 400);
    }
    
    req.validatedBody = value;
    next();
  };
};

module.exports = {
  validateBody
};
