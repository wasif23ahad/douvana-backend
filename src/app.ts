import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/error.middleware';
import logger from './lib/logger';

import routes from './routes';

// Load environment variables
dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Basic Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Drouvana Backend is running' });
});

// Routes
app.use('/api', routes);

// Error Handler (must be last)
app.use(errorHandler);

export default app;
