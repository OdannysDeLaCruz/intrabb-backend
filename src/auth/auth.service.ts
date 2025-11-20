import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PLATFORM_CLIENT } from 'src/constants';
import { SignUpFromWebsiteInterface } from './interfaces/signUpFromWebsite.interface';
import { CloudinaryService } from 'src/common/services/cloudinary.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { InformationSource } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly role_client_id = 2
  private readonly role_professional_id = 3

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly supabaseAuthService: SupabaseAuthService
  ) {}
  
  async getUserByPhone(phone: string) {
    const includeConfig = this.getIncludeConfig()
    const user = await this.prisma.user.findUnique({
      where: {
        phone_number: phone
      },
      include: includeConfig
    })
    // console.log('user', user)
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
        return {
          ...baseIncludes,
          addresses: true
        }
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
      // console.log('signUpOrSignIn', createUserDto, 'platform:', platform)
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

  async CreateIntrabblerFromWebsite(data: SignUpFromWebsiteInterface) {
    try {
      // Parse servicios if it's a string (JSON)
      let serviciosArray = data.servicios;
      if (typeof data.servicios === 'string') {
        serviciosArray = JSON.parse(data.servicios);
      }

      // Validación de datos
      if (!data.tipoRegistro) {
        throw new BadRequestException('Tipo de registro es obligatorio');
      }

      if (!data.telefono) {
        throw new BadRequestException('El telefono es obligatorio');
      }

      if (!data.nombre) {
        throw new BadRequestException('El nombre es obligatorio');
      }

      if (!data.apellido) {
        throw new BadRequestException('El apellido es obligatorio');
      }

      if (!data.profesion) {
        throw new BadRequestException('La profesión es obligatoria');
      }
      
      if (data.tipoRegistro === 'independiente') {
        if (!data.cedula) {
          throw new BadRequestException('La cédula es obligatoria');
        }

        // Validar que la cédula no exista
        const existingUser = await this.prisma.user.findUnique({
          where: { document_number: data.cedula }
        });

        if (existingUser) {
          throw new BadRequestException('La cédula ya está en uso');
        }
      }

      if (data.tipoRegistro === 'empresa') {
        if (!data.nit) {
          throw new BadRequestException('El NIT es obligatorio');
        }

        // Validar que el NIT no exista
        const existingUser = await this.prisma.user.findUnique({
          where: { document_number: data.nit }
        });

        if (existingUser) {
          throw new BadRequestException('El NIT ya está en uso');
        }
      }

      if (!data.biografia) {
        throw new BadRequestException('La biografía es obligatoria');
      }

      if (!data.servicios || data.servicios.length === 0) {
        throw new BadRequestException('Los servicios a ofrecer son obligatorios');
      }

      // Obtener archivos
      const fotoPerfil = data.files?.fotoPerfil?.[0];
      const fotoCedula = data.files?.fotoCedula?.[0];
      const camaraComercio = data.files?.camaraComercio?.[0];

      // PASO 0: CREAR USUARIO EN SUPABASE (sin OTP)
      console.log('Creando usuario en Supabase con teléfono:', data.telefono);
      let supabaseUser;
      try {
        supabaseUser = await this.supabaseAuthService.createUserWithoutOtp({
          phone: data.telefono,
          email: '',
          user_metadata: {
            nombre: data.nombre,
            apellido: data.apellido,
            profesion: data.profesion,
            tipoRegistro: data.tipoRegistro,
          }
        });
      } catch (error) {
        console.error('Error creando usuario en Supabase:', error);
        throw new BadRequestException(`No se pudo crear el usuario en Supabase: ${error.message}`);
      }

      const userId = supabaseUser.id;
      let documentTypeId: number | null = null;

      // PASO 1: TRANSACCIÓN - Crear usuario y datos relacionados en BD
      const newUser = await this.prisma.$transaction(async (prisma) => {
        // Buscar document type si es necesario (dentro de la transacción)
        if (data.tipoRegistro === 'independiente' && fotoCedula) {
          const docType = await prisma.documentType.findUnique({
            where: { name: 'identity_card_front_side' }
          });
          if (docType) {
            documentTypeId = docType.id;
          }
        } else if (data.tipoRegistro === 'empresa' && camaraComercio) {
          const docType = await prisma.documentType.findUnique({
            where: { name: 'camara_comercio' }
          });
          if (docType) {
            documentTypeId = docType.id;
          }
        }

        // Crear usuario con wallet e intrabbler_profile
        const createdUser = await prisma.user.create({
          data: {
            id: userId,
            phone_number: data.telefono,
            role_id: this.role_professional_id,
            name: data.nombre,
            lastname: data.apellido,
            is_active: true,
            document_number: data.tipoRegistro === 'independiente' ? data.cedula : data.nit,
            information_source: InformationSource.web,
            wallet: {
              create: {}
            },
            intrabbler_profile: {
              create: {
                profession: data.profesion,
                bio: data.biografia,
                is_approved: false,
                is_company: data.tipoRegistro === 'empresa'
              }
            }
          },
          include: {
            intrabbler_profile: true
          }
        });

        console.log('Usuario creado en transacción:', createdUser.id);

        // Guardar servicios prestados por el aliado dentro de la transacción
        if (createdUser.intrabbler_profile && serviciosArray.length > 0) {
          await Promise.all(
            serviciosArray.map((servicioId: string | number) =>
              prisma.professionalServicesOffered.create({
                data: {
                  intrabbler_profile_id: createdUser.intrabbler_profile.id,
                  service_category_id: parseInt(servicioId.toString())
                }
              })
            )
          );
          console.log(`${serviciosArray.length} servicios guardados en transacción para el aliado:`, createdUser.id);
        }

        return createdUser;
      });

      // PASO 2: Subir archivos a Cloudinary DESPUÉS de confirmar que la transacción fue exitosa
      let fotoPerfilUrl: string | null = null;
      let documentUrl: string | null = null;

      if (fotoPerfil) {
        try {
          fotoPerfilUrl = await this.cloudinaryService.uploadFile(fotoPerfil, 'intrabb/profiles');
          console.log('Foto de perfil cargada en Cloudinary:', fotoPerfilUrl);
        } catch (error) {
          console.error('Error subiendo foto de perfil:', error);
          // Continuar sin foto de perfil, no cortar la función
        }
      }

      if ((data.tipoRegistro === 'independiente' && fotoCedula) || (data.tipoRegistro === 'empresa' && camaraComercio)) {
        try {
          const fileToUpload = data.tipoRegistro === 'independiente' ? fotoCedula : camaraComercio;
          documentUrl = await this.cloudinaryService.uploadFile(fileToUpload, 'intrabb/documents');
          console.log('Documento cargado en Cloudinary:', documentUrl);
        } catch (error) {
          console.error('Error subiendo documento:', error);
          // Continuar sin documento, no cortar la función
        }
      }

      // PASO 3: Actualizar foto de perfil si se subió exitosamente
      if (fotoPerfilUrl) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { photo_url: fotoPerfilUrl }
        });
        console.log('URL de foto actualizada en usuario');
      }

      // PASO 4: Crear documento verificable con URL (obligatoria)
      if (documentUrl && newUser.intrabbler_profile && documentTypeId) {
        await this.prisma.verifiableDocument.create({
          data: {
            intrabbler_profile_id: newUser.intrabbler_profile.id,
            document_type_id: documentTypeId,
            document_url: documentUrl,
            reviewed_by_id: userId,
            status: 'Pending'
          }
        });
        console.log('Documento verificable creado con URL en base de datos');
      }

      return {
        success: true,
        message: 'Usuario registrado correctamente',
      };
    } catch (error) {
      console.error('Error in signUpFromWebsite:', error);
      throw error;
    }
  }
}
