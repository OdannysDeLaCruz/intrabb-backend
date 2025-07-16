import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// import { ValidatedUserDto } from '../dto/validated-user.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: supabaseJwtSecret,
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });
  }

  async validate(payload: any): Promise<any> {
    return { user_id: payload.sub, phone_number: payload.phone_number };
  }
}
