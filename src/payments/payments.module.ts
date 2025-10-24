import { 
  Module, 
  MiddlewareConsumer, 
  RequestMethod 
} from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { WebhookController } from './controllers/webhook.controller';
import { PaymentsService } from './services/payments.service';
import { WebhookService } from './services/webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentGatewaysModule } from '../payment-gateways/payment-gateways.module';
import { RawBodyMiddleware } from './middleware/raw-body.middleware';

@Module({
  imports: [PrismaModule, PaymentGatewaysModule],
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, WebhookService, RawBodyMiddleware],
  exports: [PaymentsService],
})
export class PaymentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes({ path: '/payments/webhooks/*', method: RequestMethod.POST });
  }
}
