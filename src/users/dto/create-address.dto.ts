import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export enum UserAddressType {
  billing = 'billing',
  shipping = 'shipping',
  home = 'home',
  office = 'office'
}

export class CreateAddressDto {
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(UserAddressType)
  type?: UserAddressType;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}