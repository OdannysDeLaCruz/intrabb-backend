import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  database_url: process.env.DATABASE_URL,
  supabase_url: process.env.SUPABASE_URL,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,

  // Payment Gateway
  active_payment_gateway: process.env.ACTIVE_PAYMENT_GATEWAY,
  wompi_public_key: process.env.WOMPI_PUBLIC_KEY,
  wompi_private_key: process.env.WOMPI_PRIVATE_KEY,
  wompi_webhook_secret: process.env.WOMPI_WEBHOOK_SECRET,
  wompi_base_url: process.env.WOMPI_BASE_URL,
}));
