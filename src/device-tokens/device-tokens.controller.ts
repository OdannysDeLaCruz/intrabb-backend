import { Controller, Post, Get, Delete, Body, Req, Param } from '@nestjs/common';
import { DeviceTokensService } from './device-tokens.service';
import { CreateDeviceTokenDto } from './dto/create-device-token.dto';

@Controller('device-tokens')
export class DeviceTokensController {
  constructor(private deviceTokensService: DeviceTokensService) {}

  @Post()
  async registerDeviceToken(
    @Body() createDeviceTokenDto: CreateDeviceTokenDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.deviceTokensService.registerDeviceToken(userId, createDeviceTokenDto);
  }

  @Get()
  async getUserDeviceTokens(@Req() req: any) {
    const userId = req.user.id;
    return this.deviceTokensService.getUserDeviceTokens(userId);
  }

  @Delete(':id')
  async deleteDeviceToken(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    await this.deviceTokensService.deleteDeviceToken(+id, userId);
    return { message: 'Device token deleted successfully' };
  }

  @Delete('by-token')
  async deleteDeviceTokenByString(
    @Body('token') token: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    await this.deviceTokensService.deleteDeviceTokenByString(token, userId);
    return { message: 'Device token deleted successfully' };
  }
}