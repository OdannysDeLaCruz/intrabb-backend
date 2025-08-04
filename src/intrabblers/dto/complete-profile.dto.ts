import { IsArray, IsString, MinLength, ArrayMinSize, ArrayMaxSize, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class CompleteProfileDto {
  @IsString()
  @MinLength(5, { message: 'La biografía debe tener al menos 5 palabras.' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const wordCount = value.trim().split(/\s+/).length;
      if (wordCount < 5) {
        throw new BadRequestException('La biografía debe tener al menos 5 palabras.');
      }
    }
    return value;
  })
  bio: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una categoría de servicio.' })
  @ArrayMaxSize(5, { message: 'No puede seleccionar más de 5 categorías de servicio.' })
  @IsNumber({}, { each: true, message: 'Los IDs de categorías deben ser números.' })
  professional_services_offered: number[];
}