const joi = require('joi');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = joi.object({
  NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
  PORT: joi.number().default(5000),
  MONGODB_URI: joi.string().required().description('MongoDB connection URI'),
  REDIS_HOST: joi.string().required().description('Redis host name'),
  REDIS_PORT: joi.number().default(6379),
  TALLY_HOST: joi.string().default('localhost'),
  TALLY_PORT: joi.number().default(9000),
  TALLY_API_KEY: joi.string().required().description('Shared API Key for authenticating Tally requests'),
  WHATSAPP_ACCESS_TOKEN: joi.string().required().description('Meta WhatsApp Cloud API Access Token'),
  WHATSAPP_PHONE_NUMBER_ID: joi.string().required().description('Meta WhatsApp Phone Number ID'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: joi.string().required().description('Meta WhatsApp Business Account ID'),
  WHATSAPP_VERIFY_TOKEN: joi.string().required().description('Meta Webhook verification token'),
  WHATSAPP_API_VERSION: joi.string().default('v20.0'),
  WHATSAPP_TEMPLATE_NAME: joi.string().default('invoice_notification'),
  WHATSAPP_TEMPLATE_LANGUAGE: joi.string().default('en'),
  MAX_RETRIES: joi.number().default(3),
  BACKOFF_DELAY: joi.number().default(5000),
  PDF_TEMP_DIR: joi.string().default(path.join(__dirname, '../../temp/pdfs'))
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation config error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongodb: {
    uri: envVars.MONGODB_URI
  },
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT
  },
  tally: {
    host: envVars.TALLY_HOST,
    port: envVars.TALLY_PORT,
    apiKey: envVars.TALLY_API_KEY
  },
  whatsapp: {
    accessToken: envVars.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: envVars.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: envVars.WHATSAPP_BUSINESS_ACCOUNT_ID,
    verifyToken: envVars.WHATSAPP_VERIFY_TOKEN,
    apiVersion: envVars.WHATSAPP_API_VERSION,
    templateName: envVars.WHATSAPP_TEMPLATE_NAME,
    templateLanguage: envVars.WHATSAPP_TEMPLATE_LANGUAGE
  },
  queue: {
    maxRetries: envVars.MAX_RETRIES,
    backoffDelay: envVars.BACKOFF_DELAY
  },
  pdf: {
    tempDir: envVars.PDF_TEMP_DIR
  }
};
