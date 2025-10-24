import * as Joi from 'joi';

export const ConfigurationScheme = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production').required(),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string().required(),
  SUPABASE_URL: Joi.string().required(),
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // Payment Gateway
  ACTIVE_PAYMENT_GATEWAY: Joi.string().valid('wompi').required(),

  // Wompi Configuration
  WOMPI_PUBLIC_KEY: Joi.string().required(),
  WOMPI_PRIVATE_KEY: Joi.string().required(),
  WOMPI_WEBHOOK_SECRET: Joi.string().required(),
  WOMPI_BASE_URL: Joi.string().required(),
});
