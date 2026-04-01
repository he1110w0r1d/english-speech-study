import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the server app directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port);

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📡 WebSocket available at ws://localhost:${port}/ws`);
  logger.log(`🔗 Health check: http://localhost:${port}/health`);
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
