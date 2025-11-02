import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum RegistroType {
  INDEPENDIENTE = 'independiente',
  EMPRESA = 'empresa',
}

export class SignUpFromWebsiteDto {
  @IsNotEmpty()
  @IsEnum(RegistroType)
  tipoRegistro: RegistroType;

  @IsNotEmpty()
  @IsString()
  telefono: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  apellido: string;

  @IsNotEmpty()
  @IsString()
  profesion: string;

  // Cédula - solo para independientes
  @IsOptional()
  @IsString()
  cedula?: string;

  // NIT - solo para empresas
  @IsOptional()
  @IsString()
  nit?: string;

  @IsNotEmpty()
  @IsString()
  biografia: string;

  @IsNotEmpty()
  servicios: any; // Array de IDs de categorías (viene como string JSON)

  // Archivos (opcional por ahora, se enviarán como FormData)
  @IsOptional()
  fotoPerfil?: any;

  @IsOptional()
  fotoCedula?: any;

  @IsOptional()
  camaraComercio?: any;
}
