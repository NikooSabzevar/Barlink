import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService],
})
export class SocialModule {}
