import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

/**
 * DTO para tokenizar una tarjeta de crédito/débito
 */
export class TokenizeCardDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{13,19}$/, {
    message: 'Card number must be between 13 and 19 digits',
  })
  number: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3,4}$/, {
    message: 'CVC must be 3 or 4 digits',
  })
  cvc: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(0[1-9]|1[0-2])$/, {
    message: 'Expiry month must be between 01 and 12',
  })
  exp_month: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}$/, {
    message: 'Expiry year must be 2 digits (e.g., 25 for 2025)',
  })
  exp_year: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 100, {
    message: 'Card holder name must be between 3 and 100 characters',
  })
  card_holder: string;
}
