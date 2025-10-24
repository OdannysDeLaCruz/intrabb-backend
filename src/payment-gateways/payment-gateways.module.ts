import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WompiGateway } from './gateways/wompi/wompi.gateway';
import { WompiApiService } from './gateways/wompi/wompi-api.service';
import { PaymentGatewayFactory } from './payment-gateway.factory';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    WompiGateway,
    WompiApiService,
    PaymentGatewayFactory,
    {
      provide: 'WOMPI_GATEWAY',
      useExisting: WompiGateway,
    },
  ],
  exports: [PaymentGatewayFactory, WompiGateway],
})
export class PaymentGatewaysModule {}
