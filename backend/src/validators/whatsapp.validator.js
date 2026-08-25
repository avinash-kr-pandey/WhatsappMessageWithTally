const joi = require('joi');

const whatsappWebhookSchema = joi.object({
  object: joi.string().valid('whatsapp_business_account').required(),
  entry: joi.array().items(
    joi.object({
      id: joi.string().required(),
      changes: joi.array().items(
        joi.object({
          value: joi.object({
            messaging_product: joi.string().valid('whatsapp').required(),
            metadata: joi.object({
              display_phone_number: joi.string(),
              phone_number_id: joi.string()
            }),
            contacts: joi.array().items(
              joi.object({
                profile: joi.object({
                  name: joi.string()
                }),
                wa_id: joi.string()
              })
            ),
            messages: joi.array().items(
              joi.object({
                from: joi.string().required(),
                id: joi.string().required(),
                timestamp: joi.string().required(),
                type: joi.string().valid('text', 'document', 'button', 'interactive', 'image').required(),
                text: joi.object({
                  body: joi.string()
                }),
                document: joi.object({
                  caption: joi.string(),
                  filename: joi.string(),
                  mime_type: joi.string(),
                  sha256: joi.string(),
                  id: joi.string()
                })
              })
            ),
            statuses: joi.array().items(
              joi.object({
                id: joi.string().required(),
                status: joi.string().valid('sent', 'delivered', 'read', 'failed').required(),
                timestamp: joi.string().required(),
                recipient_id: joi.string().required(),
                errors: joi.array().items(
                  joi.object({
                    code: joi.number(),
                    title: joi.string(),
                    message: joi.string()
                  })
                )
              })
            )
          }).unknown().required(),
          field: joi.string().valid('messages').required()
        })
      ).required()
    })
  ).required()
});

module.exports = {
  whatsappWebhookSchema
};
