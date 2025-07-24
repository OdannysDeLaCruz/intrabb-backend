import { Controller, Post, HttpCode, HttpStatus, Get, Req } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UseGuards } from '@nestjs/common';
import { Public } from 'src/common/decorators';
// import { JwtAuthGuard } from './guards/jwt-auth.guard';
// import { Public } from 'src/common/decorators';
// import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('phone-exists')
  @HttpCode(HttpStatus.OK)
  async phoneExists(@Body() body: { phone: string }) {
    return await this.authService.getUserByPhone(body.phone)
  }

  @Post('sign-up')
  async signUp(@Body() body: CreateUserDto) {
    return await this.authService.signUpOrSignIn(body)
  }

  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.id || req.user?.user_id
    return await this.authService.getCurrentUser(userId)
  }

  @Post('complete-profile')
  async completeProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || req.user?.user_id
    return await this.authService.updateUserProfile(userId, body)
  }
}
