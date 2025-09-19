import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';

@Injectable()
export class IntrabblersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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

  async getUserAppointments(userId: string) {
    return this.prisma.serviceAppointment.findMany({
      where: {
        intrabbler_id: userId
      },
      select: {
        id: true,
        appointment_date: true,
        duration_minutes: true,
        status: true,
        modality: true,
        created_at: true,
        updated_at: true,
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
          }
        },
        service_request: {
          select: {
            id: true,
            title: true,
            status: true,
            service_category: {
              select: {
                id: true,
                name: true,
                icon_url: true
              }
            }
          }
        },
        quotation: {
          select: {
            id: true,
            estimated_price: {
              select: {
                estimated_total: true,
                pricing_type: true
              }
            }
          }
        }
      },
      orderBy: [
        { appointment_date: 'desc' },
        { created_at: 'desc' }
      ]
    });
  }

  async getAppointmentDetail(intrabblerId: string, appointmentId: string) {
    const appointment = await this.prisma.serviceAppointment.findFirst({
      where: {
        id: Number(appointmentId),
        intrabbler_id: intrabblerId
      },
      select: {
        id: true,
        appointment_date: true,
        duration_minutes: true,
        status: true,
        modality: true,
        cancelation_reason: true,
        cancelation_at: true,
        client_id: true,
        intrabbler_id: true,
        service_request_id: true,
        quotation_id: true,
        location_address_id: true,
        created_at: true,
        updated_at: true,
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            phone_number: true,
            email: true,
            photo_url: true,
            intrabbler_profile: {
              select: {
                rating_avg: true,
                total_reviews: true,
                profession: true,
                bio: true,
                is_approved: true
              }
            }
          }
        },
        service_request: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            preferred_date: true,
            created_at: true,
            updated_at: true,
            service_category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon_url: true
              }
            },
            parameters: {
              select: {
                id: true,
                category_parameter_id: true,
                value_number: true,
                value_text: true,
                value_boolean: true,
                category_parameter: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    parameter_type: true
                  }
                }
              }
            },
            initial_budget: {
              select: {
                id: true,
                budget_unit_quantity: true,
                budget_unit_price: true,
                budget_total: true,
                pricing_type: true,
                additional_costs: true,
                created_at: true,
                updated_at: true
              }
            }
          }
        },
        quotation: {
          select: {
            id: true,
            message: true,
            status: true,
            submitted_at: true,
            responded_at: true,
            estimated_distance_km: true,
            availability_type: true,
            availability_in_days: true,
            created_at: true,
            updated_at: true,
            estimated_price: {
              select: {
                id: true,
                estimated_unit_quantity: true,
                estimated_unit_price: true,
                estimated_total: true,
                pricing_type: true,
                additional_costs: true,
                created_at: true,
                updated_at: true
              }
            }
          }
        },
        location_address: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            type: true,
            latitude: true,
            longitude: true,
            label: true,
            reference: true
          }
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            created_at: true
          }
        },
        incidents: {
          select: {
            id: true,
            incident_type: true,
            description: true,
            severity: true,
            resolved: true,
            resolved_at: true,
            resolution_notes: true,
            created_at: true,
            updated_at: true,
            reporter: {
              select: {
                id: true,
                name: true,
                lastname: true
              }
            },
            resolver: {
              select: {
                id: true,
                name: true,
                lastname: true
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          }
        }
      }
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    return appointment;
  }

  async updateAppointmentStatus(intrabblerId: string, appointmentId: string, updateData: UpdateAppointmentStatusDto) {
    // Verificar que el appointment existe y pertenece al intrabbler, incluyendo datos del cliente e intrabbler
    const appointment = await this.prisma.serviceAppointment.findFirst({
      where: {
        id: Number(appointmentId),
        intrabbler_id: intrabblerId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true
          }
        },
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true
          }
        },
        service_request: {
          select: {
            id: true,
            title: true,
            service_category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Preparar datos de actualización
    const updateFields: any = {
      status: updateData.status,
      updated_at: new Date()
    };

    // Si es cancelación, agregar razón y fecha
    if (updateData.status === 'cancelled' && updateData.cancelation_reason) {
      updateFields.cancelation_reason = updateData.cancelation_reason;
      updateFields.cancelation_at = new Date();
    }

    // Actualizar el appointment
    await this.prisma.serviceAppointment.update({
      where: { id: Number(appointmentId) },
      data: updateFields
    });

    // Enviar notificaciones push al cliente según el estado
    console.log(`📋 DEBUG - Status actualizado: ${updateData.status}`);

    try {
      const intrabblerName = `${appointment.intrabbler.name} ${appointment.intrabbler.lastname}`;

      if (updateData.status === 'confirmed') {
        // ESTADO: Profesional en camino
        console.log(`🚗 DEBUG - Enviando notificación "en camino" al cliente ${appointment.client.id}`);

        const result = await this.notificationsService.sendHybridNotification(
          appointment.client.id,
          'profesional_en_camino',
          {
            title: '🚗 Profesional en camino',
            body: `${intrabblerName} va en camino a tu ubicación`,
            data: {
              type: 'profesional_en_camino',
              appointment_id: appointmentId,
              service_request_id: appointment.service_request.id.toString(),
              intrabbler_name: intrabblerName,
              service_category: appointment.service_request.service_category.name,
              timestamp: new Date().toISOString()
            }
          },
          {
            priority: 'high',
            bypassWebSocket: true // Solo Push, NO WebSocket
          }
        );

        console.log(`🚗 Resultado notificación "en camino":`, result);
        console.log(`✅ Notificación "en camino" enviada al cliente ${appointment.client.name} ${appointment.client.lastname}`);

      } else if (updateData.status === 'in_progress') {
        // ESTADO: Trabajo iniciado
        console.log(`🔧 DEBUG - Enviando notificación "trabajo iniciado" al cliente ${appointment.client.id}`);

        const result = await this.notificationsService.sendHybridNotification(
          appointment.client.id,
          'trabajo_iniciado',
          {
            title: '🔧 Trabajo iniciado',
            body: `${intrabblerName} ya llegó a tu ubicación e inició el trabajo`,
            data: {
              type: 'trabajo_iniciado',
              appointment_id: appointmentId,
              service_request_id: appointment.service_request.id.toString(),
              intrabbler_name: intrabblerName,
              service_category: appointment.service_request.service_category.name,
              timestamp: new Date().toISOString()
            }
          },
          {
            priority: 'high',
            bypassWebSocket: true // Solo Push, NO WebSocket
          }
        );

        console.log(`🔧 Resultado notificación "trabajo iniciado":`, result);
        console.log(`✅ Notificación "trabajo iniciado" enviada al cliente ${appointment.client.name} ${appointment.client.lastname}`);

      } else if (updateData.status === 'completed') {
        // ESTADO: Trabajo finalizado
        console.log(`✅ DEBUG - Enviando notificación "trabajo finalizado" al cliente ${appointment.client.id}`);

        const result = await this.notificationsService.sendHybridNotification(
          appointment.client.id,
          'trabajo_finalizado',
          {
            title: '✅ Trabajo finalizado',
            body: `${intrabblerName} ha completado el trabajo. ¡Por favor califica el servicio!`,
            data: {
              type: 'trabajo_finalizado',
              appointment_id: appointmentId,
              service_request_id: appointment.service_request.id.toString(),
              intrabbler_name: intrabblerName,
              service_category: appointment.service_request.service_category.name,
              timestamp: new Date().toISOString()
            }
          },
          {
            priority: 'critical', // Muy importante para calificar
            bypassWebSocket: true // Solo Push, NO WebSocket
          }
        );

        console.log(`✅ Resultado notificación "trabajo finalizado":`, result);
        console.log(`✅ Notificación "trabajo finalizado" enviada al cliente ${appointment.client.name} ${appointment.client.lastname}`);

      } else if (updateData.status === 'cancelled') {
        // ESTADO: Cita cancelada - Necesitamos determinar quién canceló
        console.log(`❌ DEBUG - Enviando notificación "cita cancelada" al cliente ${appointment.client.id}`);

        // Por ahora asumimos que el aliado canceló (se puede mejorar pasando quien cancela)
        const result = await this.notificationsService.sendHybridNotification(
          appointment.client.id,
          'cita_cancelada',
          {
            title: '❌ Cita cancelada',
            body: `${intrabblerName} ha cancelado la cita. ${updateData.cancelation_reason ? 'Motivo: ' + updateData.cancelation_reason : ''}`,
            data: {
              type: 'cita_cancelada',
              appointment_id: appointmentId,
              service_request_id: appointment.service_request.id.toString(),
              intrabbler_name: intrabblerName,
              service_category: appointment.service_request.service_category.name,
              cancelation_reason: updateData.cancelation_reason || 'No especificado',
              cancelled_by: 'intrabbler', // TODO: determinar dinámicamente
              timestamp: new Date().toISOString()
            }
          },
          {
            priority: 'high',
            bypassWebSocket: true // Solo Push, NO WebSocket
          }
        );

        console.log(`❌ Resultado notificación "cita cancelada":`, result);
        console.log(`✅ Notificación "cita cancelada" enviada al cliente ${appointment.client.name} ${appointment.client.lastname}`);
      }

    } catch (error) {
      console.error(`❌ Error enviando notificación para estado ${updateData.status}:`, error);
      console.error('❌ Stack trace:', error.stack);
    }

    // Retornar el appointment actualizado con todos los detalles
    return this.getAppointmentDetail(intrabblerId, appointmentId);
  }

  async reportIncident(intrabblerId: string, appointmentId: string, incidentData: ReportIncidentDto) {
    // Verificar que el appointment existe y pertenece al intrabbler
    const appointment = await this.prisma.serviceAppointment.findFirst({
      where: {
        id: Number(appointmentId),
        intrabbler_id: intrabblerId
      }
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // Crear el reporte de incidente
    const incident = await this.prisma.appointmentIncident.create({
      data: {
        appointment_id: Number(appointmentId),
        reported_by: intrabblerId,
        incident_type: incidentData.incident_type,
        description: incidentData.description,
        severity: incidentData.severity,
        created_at: new Date()
      }
    });

    return incident;
  }
}