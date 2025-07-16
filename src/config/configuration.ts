import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  database_url: process.env.DATABASE_URL,
  supabase_url: process.env.SUPABASE_URL,
}));
