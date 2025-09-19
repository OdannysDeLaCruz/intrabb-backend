import { IsInt, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAvailabilityDto {
  @ApiProperty({
    description: 'Day of the week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6
  })
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @ApiProperty({
    description: 'Start time in HH:mm format',
    example: '09:00'
  })
  @IsString()
  start_time: string;

  @ApiProperty({
    description: 'End time in HH:mm format',
    example: '18:00'
  })
  @IsString()
  end_time: string;

  @ApiPropertyOptional({
    description: 'Whether this availability slot is active',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}