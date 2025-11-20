import { IsNotEmpty, IsString, IsOptional, IsInt, IsDateString, IsArray, ValidateNested, IsNumber, IsEnum, ArrayMaxSize } from 'class-validator';
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

export class CreateServiceRequestImageDto {
  @IsString()
  @IsNotEmpty()
  url: string; // URL de Cloudinary

  @IsOptional()
  @IsString()
  public_id?: string; // public_id de Cloudinary para eliminación

  @IsOptional()
  @IsNumber()
  image_order?: number;

  @IsOptional()
  @IsString()
  alt_text?: string;
}


export class CreateServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsInt()
  @IsNotEmpty()
  service_category_id: number;

  @IsString()
  title: string;

  @IsInt()
  @IsNotEmpty()
  location_address_id: number;

  @IsString()
  @IsOptional()
  description?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Máximo 3 imágenes permitidas' })
  @ValidateNested({ each: true })
  @Type(() => CreateServiceRequestImageDto)
  images?: CreateServiceRequestImageDto[];

  @IsOptional()
  @IsString()
  category_path?: string;
}