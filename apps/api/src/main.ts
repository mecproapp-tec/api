import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  // Captura erros não tratados
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
  });

  console.log('🚀 Iniciando aplicação...');
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔍 PORT env: ${process.env.PORT}`);
  console.log(`🔍 APP_URL env: ${process.env.APP_URL}`);

  const app = await NestFactory.create(AppModule);

  // Desativa políticas que bloqueiam CORS
  app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Configuração CORS com tratamento explícito
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://mecpro.tec.br',
        'https://www.mecpro.tec.br',
        'https://mec-pro.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    optionsSuccessStatus: 200,
  });

  // Middleware manual para garantir resposta OPTIONS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = [
      'https://mecpro.tec.br',
      'https://www.mecpro.tec.br',
      'https://mec-pro.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    if (origin && allowed.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');

  // Adiciona um endpoint de saúde simples
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';

  try {
    const server = await app.listen(port, host);
    const address = server.address();
    console.log(`✅ Servidor ouvindo em http://${host}:${port}`);
    console.log(`📡 Endereço real: ${JSON.stringify(address)}`);
    console.log(`🚀 API rodando em ${process.env.APP_URL || `http://localhost:${port}`}`);
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err);
    process.exit(1);
  }
}
bootstrap();