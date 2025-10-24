import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentGateway } from './interfaces/payment-gateway.interface';

@Injectable()
export class PaymentGatewayFactory {
  constructor(
    private readonly configService: ConfigService,
    @Inject('WOMPI_GATEWAY') private readonly wompiGateway: IPaymentGateway,
    // Futuras pasarelas:
    // @Inject('STRIPE_GATEWAY') private readonly stripeGateway: IPaymentGateway,
    // @Inject('PAYU_GATEWAY') private readonly payuGateway: IPaymentGateway,
  ) {}

  /**
   * Obtiene la pasarela activa según configuración
   */
  getActiveGateway(): IPaymentGateway {
    const activeGateway = this.configService.get<string>(
      'ACTIVE_PAYMENT_GATEWAY',
      'wompi',
    );

    switch (activeGateway) {
      case 'wompi':
        return this.wompiGateway;
      // case 'stripe':
      //   return this.stripeGateway;
      // case 'payu':
      //   return this.payuGateway;
      default:
        throw new Error(`Payment gateway '${activeGateway}' not supported`);
    }
  }

  /**
   * Obtiene una pasarela específica por nombre
   */
  getGateway(name: string): IPaymentGateway {
    switch (name) {
      case 'wompi':
        return this.wompiGateway;
      // case 'stripe':
      //   return this.stripeGateway;
      default:
        throw new Error(`Payment gateway '${name}' not found`);
    }
  }
}
