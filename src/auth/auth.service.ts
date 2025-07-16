import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class AuthService {
  private readonly role_client_id = 2
  private readonly role_professional_id = 3

  constructor(private readonly prisma: PrismaService) {}
  
  async getUserByPhone(phone: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        phone_number: phone
      }
    })
    return { user }
  }

  async updateUserProfile(userId: string, profileData: any) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: profileData.name,
          lastname: profileData.lastname,
          email: profileData.email,
          gender: profileData.gender,
        },
        include: { wallet: true }
      })

      return {
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: updatedUser
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error al actualizar el perfil',
        user: null
      }
    }
  }

  async getCurrentUser(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true }
      })

      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          user: null
        }
      }

      if (!user.is_active) {
        return {
          success: false,
          message: 'Usuario inactivo',
          user: null
        }
      }

      return {
        success: true,
        message: 'Usuario autenticado exitosamente',
        user
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener datos del usuario',
        user: null
      }
    }
  }

  async signUpOrSignIn(createUserDto: CreateUserDto) {
    try {
      // Verificar si existe el phone_number
      const { user } = await this.getUserByPhone(createUserDto.phone_number)
      if (user) {
        // Usuario registrado, iniciar sesión
        return {
          message: 'Usuario autenticado exitosamente',
          success: true,
          user,
        }
      }
    } catch (error) {
      return {
        message: 'Error al autenticar el usuario',
        success: false,
        error,
      }
    }

    try {
      const newUser = await this.prisma.user.create({
        data: {
          id: createUserDto.supabase_user_id,
          phone_number: createUserDto.phone_number,
          role_id: this.role_client_id,
          last_login: new Date(),
          is_online: true,
          is_active: true,
          wallet: {
            create: {}
          }
        }
      })

      return {
        message: 'Usuario creado exitosamente',
        success: true,
        user: newUser,
      }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.name === 'PrismaClientKnownRequestError') {
          console.log('PrismaClientKnownRequestError name')
          throw new BadRequestException(error.meta)
        }
        console.log('PrismaClientKnownRequestError instanceof')
        throw new BadRequestException(error.meta)
      }
      if (error instanceof BadRequestException) {
        console.log('BadRequestException instanceof')
        throw error
      }
      if (error instanceof InternalServerErrorException) {
        console.log('InternalServerErrorException instanceof')
        throw error
      }

      return {
        message: 'Error al crear el usuario',
        success: false,
        error,
      }
    }
  }
}
