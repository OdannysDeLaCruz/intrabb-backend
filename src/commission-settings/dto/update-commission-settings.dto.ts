import { IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCommissionSettingsDto {
  @ApiProperty({
    description: 'Commission percentage (e.g., 10.5 for 10.5%)',
    example: 10.5,
    minimum: 0,
    maximum: 100
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_percentage: number;

  @ApiPropertyOptional({
    description: 'Minimum commission amount in COP',
    example: 5000
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  min_commission_amount?: number;

  @ApiPropertyOptional({
    description: 'Maximum commission amount in COP',
    example: 500000
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  max_commission_amount?: number;

  @ApiPropertyOptional({
    description: 'Whether this commission setting is active',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}