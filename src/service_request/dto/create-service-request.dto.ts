import { IsNotEmpty, IsString, IsOptional, IsInt, IsDateString, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingType } from '@prisma/client';

export class CreateServiceRequestParameterDto {
  @IsInt()
  @IsNotEmpty()
  category_parameter_id: number;

  @IsOptional()
  value_number?: number;

  @IsOptional()
  @IsString()
  value_text?: string;

  @IsOptional()
  value_boolean?: boolean;
}

export class CreateInitialBudgetDto {
  @IsNumber()
  @IsNotEmpty()
  budget_unit_quantity: number;

  @IsNumber()
  @IsNotEmpty()
  budget_unit_price: number;

  @IsNumber()
  @IsNotEmpty()
  budget_total: number;

  @IsEnum(PricingType)
  @IsNotEmpty()
  pricing_type: PricingType;

  @IsOptional()
  @IsNumber()
  additional_costs?: number;
}


export class CreateServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsInt()
  @IsNotEmpty()
  service_category_id: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @IsNotEmpty()
  location_address_id: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsDateString()
  preferred_date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceRequestParameterDto)
  parameters?: CreateServiceRequestParameterDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInitialBudgetDto)
  initial_budget?: CreateInitialBudgetDto;
}