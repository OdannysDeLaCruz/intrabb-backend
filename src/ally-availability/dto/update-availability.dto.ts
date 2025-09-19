import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateAvailabilityDto } from './create-availability.dto';

export class UpdateAvailabilityDto {
  @ApiProperty({
    description: 'Array of availability slots to replace existing ones',
    type: [CreateAvailabilityDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAvailabilityDto)
  availability_slots: CreateAvailabilityDto[];
}