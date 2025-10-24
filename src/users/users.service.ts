import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create() {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        name: true,
        lastname: true,
        phone_number: true,
        email: true,
        gender: true,
        created_at: true,
        updated_at: true
      }
    });
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async getUserAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: {
        user_id: userId
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        type: true,
        is_primary: true,
        latitude: true,
        longitude: true,
        label: true,
        reference: true,
        created_at: true
      },
      orderBy: [
        { is_primary: 'desc' },
        { created_at: 'desc' }
      ]
    });
  }

  async saveUserAddress(userId: string, createAddressDto: CreateAddressDto) {
    // If this address is set as primary, make all other addresses non-primary
    if (createAddressDto.is_primary) {
      await this.prisma.userAddress.updateMany({
        where: {
          user_id: userId
        },
        data: {
          is_primary: false
        }
      });
    }

    // If this is the first address for the user, make it primary
    const existingAddresses = await this.prisma.userAddress.count({
      where: {
        user_id: userId
      }
    });

    const isPrimary = createAddressDto.is_primary || existingAddresses === 0;

    return this.prisma.userAddress.create({
      data: {
        user_id: userId,
        address: createAddressDto.address,
        city: createAddressDto.city || 'Valledupar',
        state: createAddressDto.state || 'Cesar',
        postal_code: createAddressDto.postal_code,
        country: createAddressDto.country || 'Colombia',
        type: createAddressDto.type || 'home',
        is_primary: isPrimary,
        latitude: createAddressDto.latitude,
        longitude: createAddressDto.longitude,
        label: createAddressDto.label,
        reference: createAddressDto.reference
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        type: true,
        is_primary: true,
        latitude: true,
        longitude: true,
        label: true,
        reference: true,
        created_at: true
      }
    });
  }

  async getUserQuotations(intrabblerId: string) {
    return this.prisma.quotations.findMany({
      where: {
        intrabbler_id: intrabblerId
      },
      select: {
        id: true,
        message: true,
        status: true,
        submitted_at: true,
        responded_at: true,
        estimated_distance_km: true,
        availability_type: true,
        availability_in_days: true,
        service_request_id: true, 
        estimated_price_id: true,
        created_at: true,
        updated_at: true,
        service_request: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            created_at: true,
            updated_at: true,
            service_category: {
              select: {
                name: true,
              }
            }
          }
        },
        estimated_price: {
          select: {
            id: true,
            estimated_unit_quantity: true,
            estimated_unit_price: true,
            estimated_total: true,
            pricing_type: true,
            created_at: true,
            updated_at: true
          }
        },
        service_appointment: true,
      },
      orderBy: {
        created_at: 'desc'
      }
    });
  }

  async getUserAppointments(clientId: string) {
    return this.prisma.serviceAppointment.findMany({
      where: {
        client_id: clientId
      },
      select: {
        id: true,
        appointment_date: true,
        duration_minutes: true,
        status: true,
        modality: true,
        created_at: true,
        updated_at: true,
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            photo_url: true,
            intrabbler_profile: {
              select: {
                rating_avg: true,
                profession: true
              }
            }
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

  async getAppointmentDetail(clientId: string, appointmentId: string) {
    const appointment = await this.prisma.serviceAppointment.findFirst({
      where: {
        id: Number(appointmentId),
        client_id: clientId
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
        intrabbler: {
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
        },
        transactions: {
          where: {
            type: 'payment_received',
          },
          select: {
            id: true,
            transaction_id: true,
            status: true,
            type: true,
            amount: true,
            created_at: true,
            wompi_payment: {
              select: {
                id: true,
                wompi_transaction_id: true,
                wompi_reference: true,
                payment_method_type: true,
                async_payment_url: true,
                created_at: true,
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 1 // Solo el pago más reciente
        }
      }
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    return appointment;
  }
}
