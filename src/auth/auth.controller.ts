import { Controller, Post, HttpCode, HttpStatus, Get, Req } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RequestWithPlatform } from '../common/middleware/platform.middleware';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('phone-exists')
  @HttpCode(HttpStatus.OK)
  async phoneExists(@Body() body: { phone: string }) {
    return await this.authService.getUserByPhone(body.phone)
  }

  @Post('sign-up')
  async signUp(@Body() body: CreateUserDto, @Req() req: RequestWithPlatform) {
    return await this.authService.signUpOrSignIn(body, req.platform)
  }

  @Get('me')
  async me(@Req() req: RequestWithPlatform) {
    const userId = req.user?.id
    return await this.authService.getCurrentUser(userId, req.platform)
  }

  @Post('complete-profile')
  async completeProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || req.user?.user_id
    return await this.authService.updateUserProfile(userId, body)
  }
}
