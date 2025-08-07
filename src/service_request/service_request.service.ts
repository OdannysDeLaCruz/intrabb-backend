import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ServiceRequest, ServiceRequestStatus } from '@prisma/client';
import { AppGateway } from '../app/app.gateway';

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
  ) {}

  async create(createServiceRequestDto: CreateServiceRequestDto): Promise<ServiceRequest> {
    const { parameters, ...serviceRequestData } = createServiceRequestDto;

    // Validate preferred_date if provided
    if (serviceRequestData.preferred_date) {
      const preferredDate = new Date(serviceRequestData.preferred_date);
      const now = new Date();
      
      // Add 2 hours (120 minutes) to current time
      const minimumAllowedTime = new Date(now.getTime() + (120 * 60 * 1000));
      
      if (preferredDate < minimumAllowedTime) {
        throw new BadRequestException(
          'La fecha preferida debe ser al menos 2 horas en el futuro'
        );
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      // Verify that the address exists and belongs to the client
      const existingAddress = await prisma.userAddress.findFirst({
        where: {
          id: serviceRequestData.location_address_id,
          user_id: serviceRequestData.client_id,
        },
      });

      if (!existingAddress) {
        throw new BadRequestException(
          'La dirección seleccionada no existe o no pertenece al usuario'
        );
      }

      // Create the service request with the existing address ID
      const serviceRequest = await prisma.serviceRequest.create({
        data: {
          ...serviceRequestData,
          preferred_date: serviceRequestData.preferred_date 
            ? new Date(serviceRequestData.preferred_date) 
            : undefined,
          parameters: parameters ? {
            create: parameters.map(param => ({
              category_parameter_id: param.category_parameter_id,
              value_number: param.value_number,
              value_text: param.value_text,
              value_boolean: param.value_boolean,
            }))
          } : undefined,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              lastname: true,
              phone_number: true,
              email: true,
            }
          },
          service_category: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          },
          location: {
            select: {
              id: true,
              address: true,
              city: true,
              state: true,
              country: true,
            }
          },
          parameters: {
            include: {
              category_parameter: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  parameter_type: true,
                }
              }
            }
          },
          quotations: {
            include: {
              intrabbler: {
                select: {
                  id: true,
                  name: true,
                  lastname: true,
                  phone_number: true,
                  email: true,
                }
              },
              estimated_price: true,
            }
          }
        }
      });

      // 🚀 NUEVA LÓGICA: Notificar a aliados en tiempo real
      // Obtener la solicitud completa con todas las relaciones para la notificación
      console.log('serviceRequest', serviceRequest)
      const completeServiceRequest = await this.findOne(serviceRequest.id);
      console.log('completeServiceRequest', completeServiceRequest)
      if (serviceRequest) {
        await this.notifyAliadosOfNewRequest(serviceRequest);
      }

      return serviceRequest;
    });
  }

  /**
   * Notifica a los aliados relevantes sobre una nueva solicitud de servicio
   */
  private async notifyAliadosOfNewRequest(serviceRequest: any) {
    try {
      // TODO: Implementar lógica de matching más sofisticada
      // Por ahora, notificamos a todos los aliados online
      // En el futuro, puedes filtrar por:
      // - categoría de servicio
      // - ubicación/radio geográfico
      // - disponibilidad del aliado
      // - rating/experiencia
      
      const onlineAliados = await this.appGateway.getOnlineAliados();
      console.log('Aliados Conectados: ', onlineAliados)
      if (onlineAliados.length === 0) {
        console.log('⚠️ No hay aliados online para notificar');
        return;
      }

      const notificationData = {
        id: serviceRequest.id,
        title: serviceRequest.description, // Usar description como title ya que no hay campo title en el schema
        description: serviceRequest.description,
        service_category_id: serviceRequest.service_category_id,
        client_id: serviceRequest.client_id,
        location_address_id: serviceRequest.location_address_id,
        preferred_date: serviceRequest.preferred_date,
        status: serviceRequest.status,
        is_active: serviceRequest.is_active,
        created_at: serviceRequest.created_at,
        updated_at: serviceRequest.updated_at,
        client: serviceRequest.client,
        service_category: serviceRequest.service_category,
        location: serviceRequest.location,
        parameters: serviceRequest.parameters || [],
        quotations: serviceRequest.quotations || [],
        _count: {
          quotations: serviceRequest.quotations?.length || 0,
        },
      };
      console.log('notificationData', notificationData)
      // Enviar notificación a todos los aliados online
      let notificationsSent = 0;
      for (const aliadoId of onlineAliados) {
        const success = await this.appGateway.notifyAliado(
          aliadoId,
          'nueva_oportunidad_para_ti',
          notificationData
        );
        if (success) {
          notificationsSent++;
        }
      }

      console.log(`🔔 Nueva solicitud ${serviceRequest.id}: ${notificationsSent} notificaciones enviadas de ${onlineAliados.length} aliados online`);
      
    } catch (error) {
      // No queremos que falle la creación de la solicitud si hay problemas con las notificaciones
      console.error('❌ Error al notificar aliados sobre nueva solicitud:', error);
    }
  }

  async findOne(id: number): Promise<ServiceRequest | null> {
    return this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            phone_number: true,
            email: true,
          }
        },
        service_category: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        location: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            country: true,
          }
        },
        parameters: {
          include: {
            category_parameter: {
              select: {
                id: true,
                name: true,
                code: true,
                parameter_type: true,
              }
            }
          }
        },
        quotations: {
          include: {
            intrabbler: {
              select: {
                id: true,
                name: true,
                lastname: true,
                phone_number: true,
                email: true,
              }
            },
            estimated_price: true,
          }
        }
      }
    });
  }

  async findByClientId(
    clientId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    data: ServiceRequest[];
    meta: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalItems = await this.prisma.serviceRequest.count({
      where: { client_id: clientId }
    });

    const data = await this.prisma.serviceRequest.findMany({
      where: { client_id: clientId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            phone_number: true,
            email: true,
          }
        },
        service_category: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        location: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            country: true,
          }
        },
        quotations: {
          include: {
            intrabbler: {
              select: {
                id: true,
                name: true,
                lastname: true,
                phone_number: true,
                email: true,
              }
            },
            estimated_price: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
  }

  /**
   * Obtiene las solicitudes disponibles para los aliados
   * Filtra solicitudes que están abiertas y recibiendo ofertas
   */
  async findAvailableOpportunities(
    page: number = 1,
    limit: number = 10,
    categoryId?: number,
    location?: string
  ): Promise<{
    data: ServiceRequest[];
    meta: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {

    try {
      
      const skip = (page - 1) * limit;
  
      // Construir filtros para solicitudes disponibles
      const whereConditions: any = {
        is_active: true,
        status: 'receiving_offers', // Solo solicitudes recibiendo ofertas
      };
  
      // Filtro opcional por categoría
      if (categoryId) {
        whereConditions.service_category_id = categoryId;
      }
  
      // Filtro opcional por ubicación (ciudad, estado, etc.)
      if (location) {
        whereConditions.location = {
          OR: [
            { city: { contains: location, mode: 'insensitive' } },
            { state: { contains: location, mode: 'insensitive' } },
            { address: { contains: location, mode: 'insensitive' } },
          ]
        };
      }
  
      // Obtener total para paginación
      const totalItems = await this.prisma.serviceRequest.count({
        where: whereConditions
      });
  
      // Obtener los datos
      const data = await this.prisma.serviceRequest.findMany({
        where: whereConditions,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              lastname: true,
              phone_number: true,
              email: true,
            }
          },
          service_category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
            }
          },
          location: {
            select: {
              id: true,
              address: true,
              city: true,
              state: true,
              country: true,
            }
          },
          parameters: {
            include: {
              category_parameter: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  parameter_type: true,
                }
              }
            }
          },
          // Incluir las cotizaciones completas
          quotations: {
            include: {
              intrabbler: {
                select: {
                  id: true,
                  name: true,
                  lastname: true,
                  phone_number: true,
                  email: true,
                }
              }
            }
          },
          // Incluir el conteo de cotizaciones existentes (útil para mostrar competencia)
          _count: {
            select: {
              quotations: true
            }
          }
        },
        orderBy: {
          created_at: 'desc' // Ordenar por fecha más reciente
        },
        skip,
        take: limit
      });
  
      const totalPages = Math.ceil(totalItems / limit);
  
      return {
        data,
        meta: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        }
      };
    } catch (error) {
      console.log(error);
    }
  }

  async updateStatus(id: number, status: ServiceRequestStatus): Promise<ServiceRequest> {
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            phone_number: true,
            email: true,
          }
        },
        service_category: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        location: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            country: true,
          }
        },
        quotations: {
          include: {
            intrabbler: {
              select: {
                id: true,
                name: true,
                lastname: true,
                phone_number: true,
                email: true,
              }
            },
            estimated_price: true,
          }
        }
      }
    });
  }
}
