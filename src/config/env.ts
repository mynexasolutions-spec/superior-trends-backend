import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  MASTER_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('exp://192.168.0.100:8081'),

  DATABASE_URL: z.string(),

  // JWT secrets
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ADMIN_ACCESS_SECRET: z.string().min(8),
  JWT_ADMIN_REFRESH_SECRET: z.string().min(8),

  // SMTP Mail Server
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string(),

  // AWS S3 Storage
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),

  // Cloudinary configuration
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Redis configurations
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Techmore SMS Gateway
  TECHMORE_AUTH_KEY: z.string(),
  TECHMORE_SENDER_ID: z.string().default('TECMOR'),
  TECHMORE_ROUTE: z.coerce.number().default(1),
  TECHMORE_TEMPLATE_ID: z.string().default('1607100000000373862'),

  // Twilio Backup SMS
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_FROM_NUMBER: z.string(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional().default(''),

  // Razorpay Gateway
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
