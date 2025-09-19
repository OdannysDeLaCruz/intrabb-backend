import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SelectApplicationDto {
  @ApiProperty({
    description: 'ID of the application to select',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  application_id: number;
}