import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateDeviceTokenDto {
  @IsString()
  token: string;

  @IsEnum(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  device_name?: string;
}