import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import accountRoutes from './routes/account.routes';
import authRoutes from './routes/auth.routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './middleware/logger';
import { connectRedis } from './config/redis';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(logger);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests',
    error: 'Rate limit exceeded. Try again in 15 minutes.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many authentication attempts',
    error: 'Rate limit exceeded. Try again in 15 minutes.',
  },
});

app.use(express.json());
app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nigeria Banking API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/accounts', accountRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer(): Promise<void> {
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`Banking API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(-1);
});