import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateSignatureDto {
  @IsOptional()
  @IsString({ message: 'El folder debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre del folder no puede exceder 100 caracteres' })
  folder?: string;
}