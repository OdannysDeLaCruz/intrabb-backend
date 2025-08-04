import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ServiceRequest, ServiceRequestStatus } from '@prisma/client';

@Injectable()
export class ServiceRequestService {
  constructor(private readonly prisma: PrismaService) {}

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

      return serviceRequest;
    });
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
