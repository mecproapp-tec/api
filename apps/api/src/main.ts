import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Desabilita algumas políticas do helmet que podem interferir no CORS
  app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Configuração detalhada de CORS
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://mecpro.tec.br',
        'https://www.mecpro.tec.br',
        'https://mec-pro.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      // Permite requisições sem origin (ex: Postman) ou se a origin estiver na lista
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    optionsSuccessStatus: 200, // Alguns navegadores antigos (IE11) esperam 204
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API rodando em ${process.env.APP_URL || `http://localhost:${port}`}`);
}
bootstrap();