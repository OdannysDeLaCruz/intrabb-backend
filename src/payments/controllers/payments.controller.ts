import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from '../services/payments.service';
import { CreateServicePaymentDto } from '../dto/create-service-payment.dto';
import { TokenizeCardDto } from '../dto/tokenize-card.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('transactions')
  async createTransaction(
    @Body() dto: CreateServicePaymentDto,
    @Request() req: any,
  ) {
    // console.log("User ID: ", req.user);
    return this.paymentsService.initiateServicePayment(
      dto.appointmentId,
      req.user.user_id,
      dto.customerEmail,
      dto.paymentMethod,
      dto.paymentMethodDetails,
    );
  }

  @Get('transactions/:transactionId')
  async getTransactionStatus(
    @Param('transactionId') transactionId: string,
    @Request() req: any,
  ) {
    return this.paymentsService.getTransactionStatus(
      transactionId,
      req.user.user_id,
    );
  }

  @Get('service/:appointmentId/status')
  async getServicePaymentStatus(
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.paymentsService.getServicePaymentStatus(
      parseInt(appointmentId),
    );
  }

  @Post('cards/tokenize')
  async tokenizeCard(@Body() dto: TokenizeCardDto) {
    return this.paymentsService.tokenizeCard(dto);
  }

  @Get('methods')
  async getPaymentMethods() {
    return this.paymentsService.getPaymentMethods();
  }
}
