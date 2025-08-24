import { IsString, IsUUID, IsNumber, IsPositive } from 'class-validator';

export class AcceptQuotationDto {
  @IsString()
  @IsUUID()
  client_id: string;
  
  @IsNumber()
  @IsPositive()
  service_request_id: number;
}