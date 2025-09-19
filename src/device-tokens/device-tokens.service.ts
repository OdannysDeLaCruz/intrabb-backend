import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceTokenDto } from './dto/create-device-token.dto';

@Injectable()
export class DeviceTokensService {
  constructor(private prisma: PrismaService) {}

  async registerDeviceToken(userId: string, dto: CreateDeviceTokenDto) {
    try {
      // Check if token already exists for this user
      const existingToken = await this.prisma.deviceToken.findFirst({
        where: {
          user_id: userId,
          fcm_token: dto.token,
        },
      });

      if (existingToken) {
        // Update existing token
        return await this.prisma.deviceToken.update({
          where: { id: existingToken.id },
          data: {
            platform: dto.platform,
            device_id: dto.device_name || `${dto.platform} Device`,
            is_active: true,
            last_used_at: new Date(),
          },
        });
      }

      // Create new token
      return await this.prisma.deviceToken.create({
        data: {
          user_id: userId,
          fcm_token: dto.token,
          platform: dto.platform,
          device_id: dto.device_name || `${dto.platform} Device`,
          is_active: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Device token already exists');
      }
      throw error;
    }
  }

  async getUserDeviceTokens(userId: string) {
    return await this.prisma.deviceToken.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });
  }

  async deleteDeviceToken(tokenId: number, userId: string) {
    const token = await this.prisma.deviceToken.findFirst({
      where: {
        id: tokenId,
        user_id: userId,
      },
    });

    if (!token) {
      throw new NotFoundException('Device token not found');
    }

    await this.prisma.deviceToken.delete({
      where: { id: tokenId },
    });
  }

  async deleteDeviceTokenByString(tokenString: string, userId: string) {
    const token = await this.prisma.deviceToken.findFirst({
      where: {
        fcm_token: tokenString,
        user_id: userId,
      },
    });

    if (!token) {
      throw new NotFoundException('Device token not found');
    }

    await this.prisma.deviceToken.delete({
      where: { id: token.id },
    });
  }

  async getActiveTokensForUser(userId: string) {
    return await this.prisma.deviceToken.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      select: {
        fcm_token: true,
        platform: true,
      },
    });
  }
}