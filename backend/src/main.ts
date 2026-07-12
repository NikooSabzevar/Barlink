import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:8080',
    'http://localhost:8082',
    'http://localhost:19006',
    'http://localhost:3001',
  ];

  // Deployed Vercel frontend URLs
  allowedOrigins.push('https://barlink-h6anpufjw-barlink.vercel.app');
  allowedOrigins.push('https://barlink-barlink.vercel.app');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Barlink backend running on http://localhost:${port}/api`);
}

bootstrap();
