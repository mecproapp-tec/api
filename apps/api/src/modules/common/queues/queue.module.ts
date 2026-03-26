import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST');
        const port = configService.get('REDIS_PORT');
        const password = configService.get('REDIS_PASSWORD');

        return {
          connection: {
            host,
            port: Number(port),
            password,
            // Tentativas e timeouts para não travar a inicialização
            connectTimeout: 5000,
            retryStrategy: (times) => Math.min(times * 50, 2000),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class QueueModule {}