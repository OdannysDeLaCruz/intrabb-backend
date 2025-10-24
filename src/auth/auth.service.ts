import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PLATFORM_CLIENT } from 'src/constants';

@Injectable()
export class AuthService {
  private readonly role_client_id = 2
  private readonly role_professional_id = 3

  constructor(private readonly prisma: PrismaService) {}
  
  async getUserByPhone(phone: string) {
    const includeConfig = this.getIncludeConfig()
    const user = await this.prisma.user.findUnique({
      where: {
        phone_number: phone
      },
      include: includeConfig
    })
    console.log('user', user)
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
    } catch {
      return {
        success: false,
        message: 'Error al actualizar el perfil',
        user: null
      }
    }
  }

  async getCurrentUser(userId: string, platform?: string) {
    try {
      const includeConfig = this.getIncludeConfig(platform)
      
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: includeConfig
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
    } catch {
      return {
        success: false,
        message: 'Error al obtener datos del usuario',
        user: null
      }
    }
  }

  private getIncludeConfig(platform?: string) {
    const baseIncludes = { 
      wallet: true,
      role: true 
    }
    
    switch (platform) {
      case 'aliados':
        return {
          ...baseIncludes,
          intrabbler_profile: {
            include: {
              verifiable_documents: {
                include: {
                  document_type: true
                }
              }
            }
          }
        }
      case 'client':
      default:
        return baseIncludes
    }
  }

  private getRoleByPlatform(platform?: string): number {
    switch (platform) {
      case 'aliados':
        return this.role_professional_id;
      case 'client':
      default:
        return this.role_client_id;
    }
  }

  private validatePlatformAccess(userRoleId: number, platform?: string): boolean {
    console.log('validatePlatformAccess', 'userRoleId', userRoleId, 'platform', platform)
    const requiredRoleId = this.getRoleByPlatform(platform);
    console.log('validatePlatformAccess', 'requiredRoleId', requiredRoleId)
    return userRoleId === requiredRoleId;
  }

  async signUpOrSignIn(createUserDto: CreateUserDto, platform?: string) {
    try {
      console.log('signUpOrSignIn', createUserDto, 'platform:', platform)
      // Verificar si existe el phone_number
      const { user } = await this.getUserByPhone(createUserDto.phone_number)
      // console.log('user::', user)
      if (user) {
        // Usuario existe - verificar acceso por plataforma
        const isValidPlatform = this.validatePlatformAccess(user.role_id, platform)
        console.log('isValidPlatform::', isValidPlatform)
        if (!isValidPlatform) {
          // console.log('isValidPlatform::', isValidPlatform)
          const platformName = platform === PLATFORM_CLIENT ? 'Cliente' : 'Aliado Profesional';
          const userRoleName = user.role?.name == 'client' ? 'Cliente' : 'Aliado Profesional';

          // return {
          //   message: `Acceso denegado. Este usuario está registrado como ${userRoleName} y no puede acceder a la plataforma de ${platformName}.`,
          //   success: false,
          //   error: 'PLATFORM_ACCESS_DENIED'
          // }

          throw new BadRequestException({
            success: false,
            message: `Actualmente estas registrado como ${userRoleName}, si quieres ser ${platformName} cambia a modo ${platformName} desde tu perfil de ${userRoleName}.`,
            error: 'PLATFORM_ACCESS_DENIED'
          })

        }

        // Obtener datos completos del usuario con includes específicos de la plataforma
        const fullUserData = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: this.getIncludeConfig(platform)
        });

        // Usuario registrado con rol correcto - iniciar sesión
        return {
          message: 'Usuario autenticado exitosamente',
          success: true,
          user: fullUserData,
        }
      }
    } catch (error) {
      console.error('Error during sign-in validation:', error);
      throw error
    }

    try {
      // Determinar rol según plataforma
      const roleId = this.getRoleByPlatform(platform);
      
      const newUser = await this.prisma.user.create({
        data: {
          id: createUserDto.supabase_user_id,
          phone_number: createUserDto.phone_number,
          role_id: roleId,
          last_login: new Date(),
          is_online: true,
          is_active: true,
          wallet: {
            create: {}
          },
          // Crear perfil intrabbler si es aliados
          ...(platform === 'aliados' && {
            intrabbler_profile: {
              create: {
                profession: 'Por definir',
                bio: ''
              }
            }
          })
        },
        include: this.getIncludeConfig(platform)
      })

      return {
        message: 'Usuario creado exitosamente',
        success: true,
        user: newUser,
      }
    } catch (error) {
      console.log('error', error)
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
