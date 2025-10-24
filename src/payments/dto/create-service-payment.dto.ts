import {
  IsInt,
  IsOptional,
  IsEnum,
  IsString,
  Min,
  ValidateNested,
  IsNumber,
  IsIn,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethodType {
  CARD = 'CARD',
  NEQUI = 'NEQUI',
  PSE = 'PSE',
  BANCOLOMBIA_TRANSFER = 'BANCOLOMBIA_TRANSFER',
}

/**
 * Detalles del método de pago (discriminado por tipo)
 *
 * Campos requeridos por método:
 * - CARD: cardToken (obligatorio), installments (opcional, default 1)
 * - NEQUI: phoneNumber (obligatorio)
 * - PSE: userType, userLegalIdType, userLegalId, financialInstitutionCode, paymentDescription (todos obligatorios)
 * - BANCOLOMBIA_TRANSFER: paymentDescription (obligatorio), ecommerceUrl (opcional)
 */
export class PaymentMethodDetailsDto {
  // Campos para CARD
  @IsOptional()
  @IsString()
  cardToken?: string; // Token de Wompi obtenido desde tokenizeCard

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number; // Número de cuotas (1 = sin cuotas)

  // Campos para NEQUI
  @IsOptional()
  @IsString()
  phoneNumber?: string; // Número de teléfono sin +57, ej: "3001234567"

  // Campos para PSE
  @IsOptional()
  @IsNumber()
  @IsIn([0, 1])
  userType?: 0 | 1; // 0 = Persona Natural, 1 = Persona Jurídica

  @IsOptional()
  @IsString()
  userLegalIdType?: string; // "CC", "NIT", "CE", "TI", "PAS", etc.

  @IsOptional()
  @IsString()
  userLegalId?: string; // Número de documento

  @IsOptional()
  @IsString()
  financialInstitutionCode?: string; // Código del banco (obtener de Wompi API)

  @IsOptional()
  @IsString()
  paymentDescription?: string; // Descripción del pago (max 64 chars)

  // Campos para BANCOLOMBIA_TRANSFER
  @IsOptional()
  @IsString()
  ecommerceUrl?: string; // URL de retorno personalizada
}

/**
 * DTO base para crear un pago de servicio
 */
export class CreateServicePaymentDto {
  @IsInt()
  appointmentId: number;

  @IsEnum(PaymentMethodType)
  paymentMethod: PaymentMethodType;

  @IsString()
  @IsEmail()
  customerEmail: string; // Email del cliente (obligatorio para Wompi)

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodDetailsDto)
  paymentMethodDetails?: PaymentMethodDetailsDto;
}
