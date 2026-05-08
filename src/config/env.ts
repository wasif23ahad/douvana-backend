import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NVIDIA_NIM_API_KEY: z.string().startsWith('nvapi-'),
  GEMINI_API_KEY: z.string().min(10),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  REDIS_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
