import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsNotEmpty } from 'class-validator';
import { AvailabilityType, QuotationStatus } from '@prisma/client';

export class UpdateQuotationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  message?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_distance_km?: number;

  @IsOptional()
  @IsEnum(AvailabilityType)
  availability_type?: AvailabilityType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  availability_in_days?: number;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;
}