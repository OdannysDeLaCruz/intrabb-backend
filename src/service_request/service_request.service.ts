import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto, CreateServiceRequestImageDto } from './dto/create-service-request.dto';
import { ServiceRequest, ServiceRequestStatus } from '@prisma/client';
import { AppGateway } from '../app/app.gateway';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Crea una nueva solicitud de servicio con URLs de imágenes de Cloudinary
   * Las imágenes ya fueron subidas directamente a Cloudinary desde el frontend
   */
  async createWithImages(
    createServiceRequestDto: CreateServiceRequestDto,
    cloudinaryImages?: CreateServiceRequestImageDto[]
  ): Promise<ServiceRequest & { 
    imageSummary?: {
      totalImages: number;
      validImages: number;
      invalidImages: number;
      errors?: string[];
    }
  }> {
    console.log(`🚀 Creando solicitud con ${cloudinaryImages?.length || 0} imágenes de Cloudinary`);

    // PASO 1: Crear la solicitud de servicio primero (sin imágenes)
    const serviceRequest = await this.create(createServiceRequestDto);
    console.log(`✅ Solicitud creada exitosamente con ID: ${serviceRequest.id}`);

    const imageSummary = {
      totalImages: cloudinaryImages?.length || 0,
      validImages: 0,
      invalidImages: 0,
      errors: [] as string[]
    };

    // PASO 2: Validar y guardar URLs de Cloudinary si las hay
    if (cloudinaryImages && cloudinaryImages.length > 0) {
      try {
        console.log(`📸 Validando ${cloudinaryImages.length} URLs de Cloudinary...`);
        
        const validImages: CreateServiceRequestImageDto[] = [];
        
        for (const image of cloudinaryImages) {
          // Validar que la URL pertenezca a nuestro Cloudinary
          if (this.cloudinaryService.validateCloudinaryUrl(image.url)) {
            // Extraer public_id si no viene incluido
            if (!image.public_id) {
              image.public_id = this.cloudinaryService.extractPublicIdFromUrl(image.url);
            }
            validImages.push(image);
            imageSummary.validImages++;
          } else {
            imageSummary.invalidImages++;
            imageSummary.errors.push(`URL inválida: ${image.url}`);
            console.warn(`⚠️ URL de Cloudinary inválida: ${image.url}`);
          }
        }

        // PASO 3: Guardar las URLs válidas en la base de datos
        if (validImages.length > 0) {
          await this.saveServiceRequestCloudinaryImages(serviceRequest.id, validImages);
          console.log(`✅ ${validImages.length} URLs de imágenes guardadas en la base de datos`);
        }

        if (imageSummary.invalidImages > 0) {
          console.warn(`⚠️ ${imageSummary.invalidImages} URLs inválidas encontradas`);
        }

      } catch (error) {
        console.error(`❌ Error crítico procesando imágenes:`, error.message);
        imageSummary.errors.push(`Error crítico: ${error.message}`);
      }
    }

    // PASO 4: Obtener la solicitud actualizada con las imágenes
    const completeServiceRequest = await this.findOne(serviceRequest.id);
    
    return {
      ...completeServiceRequest,
      imageSummary: imageSummary.totalImages > 0 ? imageSummary : undefined
    };
  }

  /**
   * Guarda las URLs de Cloudinary en la base de datos
   */
  private async saveServiceRequestCloudinaryImages(
    serviceRequestId: number,
    cloudinaryImages: CreateServiceRequestImageDto[]
  ): Promise<void> {
    const imageData = cloudinaryImages.map((image, index) => ({
      service_request_id: serviceRequestId,
      image_url: image.url,
      image_order: image.image_order || index + 1,
      alt_text: image.alt_text,
    }));

    await this.prisma.serviceRequestImage.createMany({
      data: imageData
    });
  }

  async create(createServiceRequestDto: CreateServiceRequestDto): Promise<ServiceRequest> {
    const { parameters, initial_budget, ...serviceRequestData } = createServiceRequestDto;

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

    // Verify that the address exists and belongs to the client
    const existingAddress = await this.prisma.userAddress.findFirst({
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

    const result = await this.prisma.$transaction(async (prisma) => {
      // Create initial budget if provided
      let initialBudgetId = null;
      if (initial_budget) {
        const createdBudget = await prisma.initialBudget.create({
          data: {
            budget_unit_quantity: initial_budget.budget_unit_quantity,
            budget_unit_price: initial_budget.budget_unit_price,
            budget_total: initial_budget.budget_total,
            pricing_type: initial_budget.pricing_type,
            additional_costs: initial_budget.additional_costs || 0,
          }
        });
        initialBudgetId = createdBudget.id;
      }

      // Create the service request with the existing address ID
      const serviceRequest = await prisma.serviceRequest.create({
        data: {
          ...serviceRequestData,
          preferred_date: serviceRequestData.preferred_date 
            ? new Date(serviceRequestData.preferred_date) 
            : undefined,
          initial_budget_id: initialBudgetId,
          parameters: parameters ? {
            create: parameters.map(param => ({
              category_parameter_id: param.category_parameter_id,
              value_number: param.value_number,
              value_text: param.value_text,
              value_boolean: param.value_boolean,
            }))
          } : undefined,
          images: undefined,
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
          },
          initial_budget: true,
          images: {
            select: {
              id: true,
              image_url: true,
              image_order: true,
              alt_text: true,
              created_at: true,
            },
            orderBy: {
              image_order: 'asc'
            }
          }
        }
      });

      
      return { serviceRequest };
    });
    
    // Notificar a aliados en tiempo real
    if (result.serviceRequest) {
      console.log('🎯 Notificando nueva solicitud a aliados...');
      await this.notifyAliadosOfNewRequest(result.serviceRequest);
    }

    return result.serviceRequest;
  }

  /**
   * Notifica a los aliados relevantes sobre una nueva solicitud de servicio
   * Usa sistema híbrido: WebSocket para online, Push para offline
   */
  private async notifyAliadosOfNewRequest(serviceRequest: any) {
    try {
      // TODO: Implementar lógica de matching más sofisticada
      // Por ahora, notificamos a todos los aliados activos
      // En el futuro, puedes filtrar por:
      // - categoría de servicio
      // - ubicación/radio geográfico
      // - disponibilidad del aliado
      // - rating/experiencia

      // Obtener todos los aliados activos (role "intrabbler")
      const aliados = await this.prisma.user.findMany({
        where: {
          role: {
            name: 'intrabbler'
          },
          is_active: true,
        },
        select: {
          id: true,
          name: true,
          lastname: true,
        },
      });

      console.log('🔍 DEBUG - Aliados encontrados:', aliados.map(a => ({ id: a.id, name: `${a.name} ${a.lastname}` })));

      // DEBUG: También verificar todos los roles
      const allRoles = await this.prisma.role.findMany();
      console.log('🔍 DEBUG - Todos los roles:', allRoles);

      if (aliados.length === 0) {
        console.log('⚠️ No hay aliados activos para notificar');
        return;
      }

      // Preparar payload de notificación para Push
      const notificationPayload = {
        title: 'Nueva Oportunidad de Trabajo',
        body: `${serviceRequest.service_category?.name}: ${serviceRequest.description}`,
        data: {
          type: 'nueva_oportunidad',
          service_request_id: serviceRequest.id.toString(),
          service_category: serviceRequest.service_category?.name || '',
          client_name: serviceRequest.client ? `${serviceRequest.client.name} ${serviceRequest.client.lastname}`.trim() : '',
          location: serviceRequest.location?.city || '',
          created_at: serviceRequest.created_at?.toISOString() || '',
        },
        imageUrl: serviceRequest.images?.[0]?.image_url, // Primera imagen si existe
      };
      console.log('🔍 DEBUG - Payload de notificación PUSH:', notificationPayload);

      // Preparar datos para WebSocket (formato original)
      const websocketData = {
        id: serviceRequest.id,
        title: serviceRequest.description,
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
        initial_budget: serviceRequest.initial_budget,
      };

      console.log('🔍 DEBUG - Datos para WebSocket:', websocketData);

      // Enviar notificaciones híbridas (WebSocket + Push) a todos los aliados
      let successCount = 0;
      const aliadoIds = aliados.map(aliado => aliado.id);

      for (const aliadoId of aliadoIds) {
        try {
          const result = await this.notificationsService.sendHybridNotification(
            aliadoId,
            'nueva_oportunidad',
            notificationPayload,
            {
              priority: 'high',
              websocketCallback: async (userId, event, data) => {
                // Usar los datos originales de WebSocket
                return await this.appGateway.notifyAliado(userId, 'nueva_oportunidad_para_ti', websocketData);
              },
            }
          );

          if (result.success) {
            successCount++;
            const method = result.websocket ? 'WebSocket' : result.push ? 'Push' : 'Queue';
            console.log(`✅ Notificación enviada a aliado ${aliadoId} via ${method}`);
          } else if (result.queued) {
            console.log(`⏳ Notificación encolada para aliado ${aliadoId}`);
          }
        } catch (error) {
          console.error(`❌ Error enviando notificación a aliado ${aliadoId}:`, error);
        }
      }

      console.log(`🔔 Nueva solicitud ${serviceRequest.id}: ${successCount} notificaciones enviadas exitosamente de ${aliados.length} aliados`);      
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
          // select: {
          //   id: true,
          //   name: true,
          //   lastname: true,
          //   phone_number: true,
          //   email: true,
          // },
          include: {
            reviews_given: true,
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
            service_request: {
              select: {
                id: true,
              }
            }
          }
        },
        appointments: true,
        initial_budget: true,
        images: {
          select: {
            id: true,
            image_url: true,
            image_order: true,
            alt_text: true,
            created_at: true,
          },
          orderBy: {
            image_order: 'asc'
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
        },
        appointments: true,
        initial_budget: true,
        images: {
          select: {
            id: true,
            image_url: true,
            image_order: true,
            alt_text: true,
            created_at: true,
          },
          orderBy: {
            image_order: 'asc'
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
          initial_budget: {
            select: {
              id: true,
              budget_unit_quantity: true,
              budget_unit_price: true,
              budget_total: true,
              pricing_type: true,
              additional_costs: true
            }
          },
          // Incluir el conteo de cotizaciones existentes (útil para mostrar competencia)
          _count: {
            select: {
              quotations: true
            }
          },
          images: {
            select: {
              id: true,
              image_url: true,
              image_order: true,
              alt_text: true,
              created_at: true,
            },
            orderBy: {
              image_order: 'asc'
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
        },
        initial_budget: true,
        images: {
          select: {
            id: true,
            image_url: true,
            image_order: true,
            alt_text: true,
            created_at: true,
          },
          orderBy: {
            image_order: 'asc'
          }
        }
      }
    });
  }

  /**
   * Creates a new fixed price service request
   */
  async createFixedPrice(data: {
    client_id: string;
    service_category_id: number;
    request_type: 'fixed_price';
    amount: number;
    currency: string;
  }): Promise<ServiceRequest> {
    // Verify that the service category has fixed price enabled
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: data.service_category_id },
      select: { 
        id: true, 
        name: true, 
        has_fixed_price: true, 
        fixed_price_amount: true 
      }
    });

    if (!category) {
      throw new BadRequestException('La categoría de servicio no existe');
    }

    if (!category.has_fixed_price) {
      throw new BadRequestException('Esta categoría no tiene precio fijo habilitado');
    }

    if (!category.fixed_price_amount || category.fixed_price_amount.toString() !== data.amount.toString()) {
      throw new BadRequestException('El monto no coincide con el precio fijo de la categoría');
    }

    // Create the fixed price service request
    const serviceRequest = await this.prisma.serviceRequest.create({
      data: {
        client_id: data.client_id,
        service_category_id: data.service_category_id,
        request_type: data.request_type,
        title: `Servicio de precio fijo: ${category.name}`,
        description: `Solicitud de servicio de precio fijo para ${category.name}`,
        status: 'receiving_applications', // Special status for fixed price requests
        amount: data.amount,
        currency: data.currency,
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
        }
      }
    });

    // Notify available professionals via WebSocket
    try {
      await this.appGateway.notifyNewFixedPriceRequest(serviceRequest);
    } catch (error) {
      console.error('Error enviando notificación WebSocket:', error);
    }

    return serviceRequest;
  }

  /**
   * Find applications for a specific service request
   */
  async findApplicationsForRequest(serviceRequestId: number) {
    return this.prisma.applications.findMany({
      where: {
        service_request_id: serviceRequestId
      },
      include: {
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            phone_number: true,
            email: true,
            photo_url: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
  }
}
