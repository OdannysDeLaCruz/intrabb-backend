import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({
    description: 'ID of the service request to apply for',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  service_request_id: number;

  @ApiPropertyOptional({
    description: 'Optional message from the ally explaining their application',
    example: 'I have 5 years of experience in this type of service and can start immediately.'
  })
  @IsString()
  @IsOptional()
  message?: string;
}