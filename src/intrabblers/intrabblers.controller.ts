import { Controller, Post, Body, Request, Get, Param, Patch } from '@nestjs/common';
import { IntrabblersService } from './intrabblers.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Controller('intrabblers')
export class IntrabblersController {
  constructor(private readonly intrabblersService: IntrabblersService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    const userId = req.user.id;
    const result = await this.intrabblersService.getProfile(userId);
    
    return {
      success: true,
      data: result
    };
  }

  @Post('complete-profile')
  async completeProfile(@Request() req, @Body() completeProfileDto: CompleteProfileDto) {
    const userId = req.user.id;
    const result = await this.intrabblersService.completeProfile(userId, completeProfileDto);
    
    return {
      success: true,
      message: 'Perfil profesional completado exitosamente',
      data: result
    };
  }

  @Patch(':userId/approve')
  async approveProfile(@Param('userId') userId: string) {
    const result = await this.intrabblersService.approveProfile(userId);
    
    return {
      success: true,
      message: 'Perfil aprobado exitosamente',
      data: result
    };
  }
}