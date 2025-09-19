import { IsNotEmpty } from "class-validator";

export class CreateUserDto {
  @IsNotEmpty()
  // @IsUUID()
  supabase_user_id: string;

  @IsNotEmpty()
  phone_number: string;
}
