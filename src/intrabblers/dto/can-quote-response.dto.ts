export enum CanQuoteStatus {
  ELIGIBLE = 'eligible',
  INACTIVE = 'inactive',
  NOT_VERIFIED = 'not_verified',
  IN_DEBT = 'in_debt'
}

export interface CanQuoteResponseDto {
  can_quote: boolean;
  status: CanQuoteStatus;
  current_balance: number;
  message: string;
  debt_limit?: number;
}