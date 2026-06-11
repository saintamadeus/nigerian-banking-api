import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import register, { httpRequestCounter, httpRequestDuration } from './config/metrics';
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

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });
  next();
});

app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nigeria Banking API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/accounts', accountRoutes);

app.use(notFound);
app.use(errorHandler);

// Export app for Supertest — must be before startServer() is called
export default app;

async function startServer(): Promise<void> {
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`Banking API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

// Only start the server if this file is run directly, not when imported by tests
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(-1);
  });
}