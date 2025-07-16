import * as Joi from 'joi';

export const ConfigurationScheme = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production').required(),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string().required(),
  SUPABASE_URL: Joi.string().required()
});
