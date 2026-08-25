/**
 * Format helper for REST API standard JSON responses
 */
const successResponse = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const errorResponse = (res, message, error = {}, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'production' && statusCode === 500 ? 'Internal Server Error' : error
  });
};

module.exports = {
  successResponse,
  errorResponse
};
