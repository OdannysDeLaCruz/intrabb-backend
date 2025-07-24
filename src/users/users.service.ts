import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        name: true,
        lastname: true,
        phone_number: true,
        email: true,
        gender: true,
        created_at: true,
        updated_at: true
      }
    });
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async getUserAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: {
        user_id: userId
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        type: true,
        is_primary: true,
        latitude: true,
        longitude: true,
        label: true,
        reference: true,
        created_at: true
      },
      orderBy: [
        { is_primary: 'desc' },
        { created_at: 'desc' }
      ]
    });
  }

  async saveUserAddress(userId: string, createAddressDto: CreateAddressDto) {
    // If this address is set as primary, make all other addresses non-primary
    if (createAddressDto.is_primary) {
      await this.prisma.userAddress.updateMany({
        where: {
          user_id: userId
        },
        data: {
          is_primary: false
        }
      });
    }

    // If this is the first address for the user, make it primary
    const existingAddresses = await this.prisma.userAddress.count({
      where: {
        user_id: userId
      }
    });

    const isPrimary = createAddressDto.is_primary || existingAddresses === 0;

    return this.prisma.userAddress.create({
      data: {
        user_id: userId,
        address: createAddressDto.address,
        city: createAddressDto.city || 'Valledupar',
        state: createAddressDto.state || 'Cesar',
        postal_code: createAddressDto.postal_code,
        country: createAddressDto.country || 'Colombia',
        type: createAddressDto.type || 'home',
        is_primary: isPrimary,
        latitude: createAddressDto.latitude,
        longitude: createAddressDto.longitude,
        label: createAddressDto.label,
        reference: createAddressDto.reference
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        type: true,
        is_primary: true,
        latitude: true,
        longitude: true,
        label: true,
        reference: true,
        created_at: true
      }
    });
  }
}
