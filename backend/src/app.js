const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const tallyRoutes = require('./routes/tally.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const { errorHandler } = require('./middleware/error.middleware');
const config = require('./config/env');
const { successResponse } = require('./utils/response');

const app = express();

// 1. Security Middlewares
app.use(helmet());
app.use(cors());

// Rate limiting (max 100 requests per window limit for APIs)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// 2. Body Parser (Accept standard JSON payloads)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. API Routing
app.use('/api/tally', tallyRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// 4. Health Check Endpoint
app.get('/health', async (req, res) => {
  // Check Redis Queue Connection State
  const { Queue } = require('bullmq');
  const { redisConnection } = require('./config/redis');
  let redisState = 'disconnected';
  try {
    const q = new Queue('healthcheck-temp', { connection: redisConnection });
    const client = await q.client;
    const ping = await client.ping();
    if (ping === 'PONG') {
      redisState = 'connected';
    }
    await q.close();
  } catch (e) {
    redisState = `disconnected (${e.message})`;
  }

  // Check Tally Connection State
  let tallyState = 'disconnected';
  try {
    const tallyService = require('./services/tally.service');
    // Try sending a dummy request to check if Tally port is listening
    await tallyService.sendXmlRequest('<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>DbInfo</ID></HEADER></ENVELOPE>');
    tallyState = 'connected';
  } catch (e) {
    tallyState = `disconnected (${e.message})`;
  }

  // Verify whatsapp configure vars state
  const hasWhatsAppConfig = config.whatsapp.accessToken && config.whatsapp.phoneNumberId ? 'configured' : 'missing';

  return successResponse(res, 'System Health Status', {
    status: redisState === 'connected' && tallyState === 'connected' ? 'ok' : 'degraded',
    tally: tallyState,
    redis: redisState,
    whatsapp: hasWhatsAppConfig,
    timestamp: new Date()
  });
});

// 5. Error Handler Middleware
app.use(errorHandler);

module.exports = app;
