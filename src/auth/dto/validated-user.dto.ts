import { IsInt, IsString } from 'class-validator';

export class ValidatedUserDto {
  @IsInt()
  user_id: number;

  @IsString()
  phone_number: string;
}
