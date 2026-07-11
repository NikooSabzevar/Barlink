import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BarsModule } from './bars/bars.module';
import { QueueModule } from './queue/queue.module';
import { WorkersModule } from './workers/workers.module';
import { GatewayModule } from './gateway/gateway.module';
import { DealsModule } from './deals/deals.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    BarsModule,
    QueueModule,
    WorkersModule,
    GatewayModule,
    DealsModule,
    SocialModule,
  ],
})
export class AppModule {}
