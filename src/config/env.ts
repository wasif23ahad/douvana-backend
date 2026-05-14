import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  NVIDIA_NIM_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1).optional(),
  FRONTEND_URL: z.string().min(1).default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  REDIS_URL: z.string().min(1).optional(),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map(i => i.path.join('.')).join(', ');
  console.error(`[env] Missing or invalid environment variables: ${missing}`);
  // Don't throw — return partial env so the process can start and return a 500 from routes
}

export const env = result.success ? result.data : (process.env as any);
