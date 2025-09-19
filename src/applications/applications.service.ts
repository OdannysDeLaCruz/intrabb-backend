import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SelectApplicationDto } from './dto/select-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApplicationDto: CreateApplicationDto, intrabblerUserId: string) {
    const { service_request_id, message } = createApplicationDto;

    // Verificar que la solicitud existe y es de tipo fixed_price
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: service_request_id },
      include: {
        service_category: true,
        client: true
      }
    });

    if (!serviceRequest) {
      throw new NotFoundException('Solicitud de servicio no encontrada');
    }

    if (serviceRequest.request_type !== 'fixed_price') {
      throw new BadRequestException('Las aplicaciones solo están permitidas para servicios de precio fijo');
    }

    if (serviceRequest.status !== 'receiving_offers') {
      throw new BadRequestException('Esta solicitud de servicio no está aceptando aplicaciones');
    }

    // Verificar que el aliado no puede aplicar a su propia solicitud
    if (serviceRequest.client_id === intrabblerUserId) {
      throw new BadRequestException('No puedes aplicar a tu propia solicitud de servicio');
    }

    // Verificar que el aliado está aprobado
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: intrabblerUserId }
    });

    if (!intrabblerProfile || !intrabblerProfile.is_approved) {
      throw new ForbiddenException('Debes ser un profesional aprobado para aplicar a servicios');
    }

    // Verificar que el aliado tiene horarios configurados para servicios de precio fijo
    const hasAvailability = await this.prisma.allyAvailability.findFirst({
      where: { 
        intrabbler_id: intrabblerUserId,
        is_active: true 
      }
    });

    if (!hasAvailability) {
      throw new BadRequestException('Debes configurar tu horario de disponibilidad antes de aplicar a servicios de precio fijo');
    }

    // Verificar que el aliado no ha aplicado antes
    const existingApplication = await this.prisma.applications.findUnique({
      where: {
        service_request_id_intrabbler_id: {
          service_request_id,
          intrabbler_id: intrabblerUserId
        }
      }
    });

    if (existingApplication) {
      throw new BadRequestException('Ya has aplicado a esta solicitud de servicio');
    }

    // Crear la aplicación
    const application = await this.prisma.applications.create({
      data: {
        service_request_id,
        intrabbler_id: intrabblerUserId,
        message,
        status: 'pending'
      },
      include: {
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            photo_url: true,
            intrabbler_profile: {
              select: {
                rating_avg: true,
                total_reviews: true,
                profession: true
              }
            }
          }
        },
        service_request: {
          select: {
            id: true,
            title: true,
            service_category: {
              select: {
                name: true,
                fixed_price_amount: true,
                price_currency: true
              }
            }
          }
        }
      }
    });

    return application;
  }

  async findByServiceRequest(serviceRequestId: number) {
    const applications = await this.prisma.applications.findMany({
      where: { service_request_id: serviceRequestId },
      include: {
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            photo_url: true,
            intrabbler_profile: {
              select: {
                rating_avg: true,
                total_reviews: true,
                profession: true,
                bio: true
              }
            },
            ally_availability: {
              where: { is_active: true },
              select: {
                day_of_week: true,
                start_time: true,
                end_time: true
              }
            }
          }
        }
      },
      orderBy: {
        applied_at: 'asc'
      }
    });

    return applications;
  }

  async findByIntrabbler(intrabblerUserId: string) {
    const applications = await this.prisma.applications.findMany({
      where: { intrabbler_id: intrabblerUserId },
      include: {
        service_request: {
          select: {
            id: true,
            title: true,
            description: true,
            preferred_date: true,
            status: true,
            service_category: {
              select: {
                name: true,
                fixed_price_amount: true,
                price_currency: true
              }
            },
            client: {
              select: {
                id: true,
                name: true,
                lastname: true,
                photo_url: true
              }
            }
          }
        }
      },
      orderBy: {
        applied_at: 'desc'
      }
    });

    return applications;
  }

  async rejectOtherApplications(serviceRequestId: number, selectedApplicationId: number) {
    return await this.prisma.applications.updateMany({
      where: {
        service_request_id: serviceRequestId,
        id: { not: selectedApplicationId }
      },
      data: {
        status: 'rejected'
      }
    });
  }

  async selectApplication(selectApplicationDto: SelectApplicationDto, clientUserId: string) {
    const { application_id } = selectApplicationDto;

    // Buscar la aplicación
    const application = await this.prisma.applications.findUnique({
      where: { id: application_id },
      include: {
        service_request: {
          include: {
            client: true,
            service_category: true
          }
        },
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            intrabbler_profile: true
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException('Aplicación no encontrada');
    }

    // Verificar que el cliente es el dueño de la solicitud
    if (application.service_request.client_id !== clientUserId) {
      throw new ForbiddenException('Solo puedes seleccionar aplicaciones para tus propias solicitudes de servicio');
    }

    // Verificar que la solicitud está recibiendo ofertas
    if (application.service_request.status !== 'receiving_offers') {
      throw new BadRequestException('Esta solicitud de servicio no está aceptando selecciones');
    }

    // Verificar que la aplicación está pendiente
    if (application.status !== 'pending') {
      throw new BadRequestException('Esta aplicación ya ha sido procesada');
    }

    // Usar transacción para garantizar consistencia
    const result = await this.prisma.$transaction(async (prisma) => {
      // Seleccionar la aplicación
      const selectedApplication = await prisma.applications.update({
        where: { id: application_id },
        data: {
          status: 'selected',
          selected_at: new Date()
        }
      });

      // Rechazar todas las demás aplicaciones usando la función reutilizable
      await this.rejectOtherApplications(application.service_request_id, application_id);

      // Actualizar el estado de la solicitud
      await prisma.serviceRequest.update({
        where: { id: application.service_request_id },
        data: {
          status: 'offer_accepted'
        }
      });

      return selectedApplication;
    });

    return {
      ...result,
      service_request: application.service_request,
      intrabbler: application.intrabbler
    };
  }

  async findOne(id: number) {
    const application = await this.prisma.applications.findUnique({
      where: { id },
      include: {
        service_request: {
          include: {
            service_category: true,
            client: {
              select: {
                id: true,
                name: true,
                lastname: true,
                photo_url: true
              }
            }
          }
        },
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            photo_url: true,
            intrabbler_profile: {
              select: {
                rating_avg: true,
                total_reviews: true,
                profession: true,
                bio: true
              }
            },
            ally_availability: {
              where: { is_active: true },
              select: {
                day_of_week: true,
                start_time: true,
                end_time: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException('Aplicación no encontrada');
    }

    return application;
  }
}