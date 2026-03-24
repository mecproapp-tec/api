import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://mecpro.tec.br',
      'https://www.mecpro.tec.br',
      'https://mec-pro.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
  console.log('🔥 SUBIU A API CORRETA 🔥');
}
bootstrap();