import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsNotEmpty, IsBoolean } from 'class-validator';
import { AvailabilityType, PricingType } from '@prisma/client';

export class CreateEstimatedPriceDto {
  @IsNumber()
  @Min(0)
  estimated_unit_quantity: number;

  @IsNumber()
  @Min(0)
  estimated_unit_price: number;

  @IsEnum(PricingType)
  pricing_type: PricingType;
}

export class CreateQuotationDto {
  @IsString()
  @IsOptional()
  message: string;

  @IsNumber()
  @Min(1)
  service_request_id: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_distance_km?: number;

  @IsEnum(AvailabilityType)
  availability_type: AvailabilityType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  availability_in_days?: number;

  @IsNotEmpty()
  estimated_price: CreateEstimatedPriceDto;

  @IsOptional()
  @IsBoolean()
  accept_bonus?: boolean;
}