import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class IntrabblersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: userId },
      include: {
        professional_services_offered: {
          include: {
            service_category: {
              select: {
                id: true,
                name: true,
                description: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!intrabblerProfile) {
      throw new UnauthorizedException('No tienes autorización para acceder a este perfil');
    }

    return intrabblerProfile;
  }

  async approveProfile(userId: string) {
    // Buscar el perfil del intrabbler
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: userId }
    });

    if (!intrabblerProfile) {
      throw new UnauthorizedException('No se encontró el perfil del intrabbler');
    }

    // Aprobar el perfil
    const approvedProfile = await this.prisma.intrabblerProfile.update({
      where: { id: intrabblerProfile.id },
      data: { is_approved: true }
    });

    return approvedProfile;
  }

  async completeProfile(userId: string, completeProfileDto: CompleteProfileDto) {
    const { bio, professional_services_offered } = completeProfileDto;

    // Verificar que todas las categorías existan
    const existingCategories = await this.prisma.serviceCategory.findMany({
      where: {
        id: { in: professional_services_offered },
        is_active: true
      }
    });

    if (existingCategories.length !== professional_services_offered.length) {
      const foundIds = existingCategories.map(cat => cat.id);
      const missingIds = professional_services_offered.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Las siguientes categorías no existen: ${missingIds.join(', ')}`);
    }

    // Buscar el perfil del intrabbler
    let intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: userId }
    });

    if (!intrabblerProfile) {
      throw new UnauthorizedException('No tienes autorización para completar este perfil');
    }

    // Actualizar biografía
    intrabblerProfile = await this.prisma.intrabblerProfile.update({
      where: { id: intrabblerProfile.id },
      data: { bio: bio }
    });

    // Eliminar servicios profesionales existentes
    await this.prisma.professionalServicesOffered.deleteMany({
      where: { intrabbler_profile_id: intrabblerProfile.id }
    });

    // Crear nuevos servicios profesionales
    const professionalServices = professional_services_offered.map(categoryId => ({
      intrabbler_profile_id: intrabblerProfile.id,
      service_category_id: categoryId
    }));

    await this.prisma.professionalServicesOffered.createMany({
      data: professionalServices
    });

    // Devolver el perfil actualizado con los servicios
    return await this.prisma.intrabblerProfile.findUnique({
      where: { id: intrabblerProfile.id },
      include: {
        professional_services_offered: {
          include: {
            service_category: {
              select: {
                id: true,
                name: true,
                description: true,
                slug: true
              }
            }
          }
        }
      }
    });
  }
}