import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto, CreateServiceRequestImageDto } from './dto/create-service-request.dto';
import { ServiceRequest, ServiceRequestStatus } from '@prisma/client';
import { AppGateway } from '../app/app.gateway';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
    private readonly cloudinaryService: CloudinaryService,
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

    let imageSummary = {
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
    const { parameters, initial_budget, images, ...serviceRequestData } = createServiceRequestDto;

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
      await this.notifyAliadosOfNewRequest(result.serviceRequest);
    }

    return result.serviceRequest;
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
        initial_budget: serviceRequest.initial_budget,
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
        appointment: true,
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
        appointment: true,
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
}
