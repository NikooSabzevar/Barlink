import { Module } from '@nestjs/common';
import { BarLinkGateway } from './barlink.gateway';

@Module({
  providers: [BarLinkGateway],
  exports: [BarLinkGateway],
})
export class GatewayModule {}
