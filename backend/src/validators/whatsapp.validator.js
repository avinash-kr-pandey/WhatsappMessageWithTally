const joi = require('joi');

const whatsappWebhookSchema = joi.object({
  id: joi.string().required(),
  channelId: joi.number().optional().allow(null),
  receiverNumber: joi.string().optional().allow(null, ''),
  receiverName: joi.string().optional().allow(null, ''),
  senderNumber: joi.string().required(),
  senderName: joi.string().optional().allow(null, ''),
  boundType: joi.string().valid('in', 'out').required(),
  itemType: joi.string().required(),
  value: joi.string().optional().allow(null, ''),
  time: joi.number().optional(),
  caption: joi.string().optional().allow(null, ''),
  isForwarded: joi.boolean().optional()
}).unknown();

module.exports = {
  whatsappWebhookSchema
};
