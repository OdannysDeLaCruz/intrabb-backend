import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
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
    const user_id = payload.sub;
    
    if (!user_id) {
      throw new UnauthorizedException('Token inválido');
    }

    // Validar que el usuario existe en la base de datos
    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        id: true,
        phone_number: true,
        role: true,
      },
    });
    // console.log('user::', user);
    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      user_id: user.id,
      phone_number: user.phone_number,
      role: user.role,
    };
  }
}
