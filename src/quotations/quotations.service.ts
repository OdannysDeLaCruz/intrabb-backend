import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../app/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';

@Injectable()
export class QuotationsService {
  private COMMISSION_PERCENTAGE = 10;
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
    private readonly notificationsService: NotificationsService,
  ) {
  }

  async create(createQuotationDto: CreateQuotationDto, intrabblerUserId: string) {
    const { estimated_price, service_request_id, ...quotationData } = createQuotationDto;

    // Verify that the service request exists and is accepting offers
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: service_request_id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
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
        }
      }
    });

    if (!serviceRequest) {
      throw new NotFoundException('Solicitud de servicio no encontrada');
    }

    if (serviceRequest.status !== 'receiving_offers') {
      throw new BadRequestException('Esta solicitud de servicio ya no está aceptando ofertas');
    }

    if (!serviceRequest.is_active) {
      throw new BadRequestException('Esta solicitud de servicio ya no está activa');
    }

    // Check if the intrabbler already has a quotation for this request
    const existingQuotation = await this.prisma.quotations.findFirst({
      where: {
        service_request_id,
        intrabbler_id: intrabblerUserId,
      }
    });

    if (existingQuotation) {
      throw new BadRequestException('Ya tienes una cotización para esta solicitud de servicio');
    }

    // Verify that the user is an intrabbler and approved
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: intrabblerUserId },
    });

    if (!intrabblerProfile) {
      throw new ForbiddenException('Solo los aliados pueden crear cotizaciones');
    }

    if (!intrabblerProfile.is_approved) {
      throw new ForbiddenException('Su perfil de aliado debe estar aprobado para crear cotizaciones');
    }

    // Verify wallet balance - cannot create quotations if debt is 20,000 COP or more
    const aliado_wallet = await this.prisma.wallet.findUnique({
      where: { user_id: intrabblerUserId },
    });

    if (!aliado_wallet) {
      throw new BadRequestException('Wallet del aliado no encontrada');
    }

    const MAXIMUM_DEBT_ALLOWED = -20000; // COP 20,000 negative balance
    if (aliado_wallet.balance < MAXIMUM_DEBT_ALLOWED) {
      // throw new ForbiddenException('No puedes crear cotizaciones con una mora igual o mayor a COP 20.000. Tu balance actual es: COP ' + aliado_wallet.balance.toLocaleString('es-CO'));
      throw new BadRequestException(`Tienes un saldo de COP ${aliado_wallet.balance.toLocaleString('es-CO')} por pagar. Recarga tu cuenta para que puedas enviar esta cotización.`)
    }

    // Create the quotation in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the estimated price first
      const estimatedPrice = await tx.estimatedPricesQuotations.create({
        data: {
          estimated_unit_quantity: estimated_price.estimated_unit_quantity,
          estimated_unit_price: estimated_price.estimated_unit_price,
          estimated_total: estimated_price.estimated_unit_quantity * estimated_price.estimated_unit_price,
          pricing_type: estimated_price.pricing_type,
        }
      });

      // Create the quotation
      const quotation = await tx.quotations.create({
        data: {
          ...quotationData,
          service_request_id,
          intrabbler_id: intrabblerUserId,
          estimated_price_id: estimatedPrice.id,
        },
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
      });

      return { quotation, estimatedPrice };
    });

    // Prepare notification data
    const notificationData = {
      id: result.quotation.id,
      message: result.quotation.message,
      status: result.quotation.status,
      submitted_at: result.quotation.submitted_at,
      estimated_distance_km: result.quotation.estimated_distance_km,
      availability_type: result.quotation.availability_type,
      availability_in_days: result.quotation.availability_in_days,
      intrabbler: result.quotation.intrabbler,
      estimated_price: {
        id: result.estimatedPrice.id,
        estimated_unit_quantity: result.estimatedPrice.estimated_unit_quantity,
        estimated_unit_price: result.estimatedPrice.estimated_unit_price,
        estimated_total: result.estimatedPrice.estimated_total,
        pricing_type: result.estimatedPrice.pricing_type,
        additional_costs: 0, // You can calculate this based on your business logic
      },
      service_request: {
        id: serviceRequest.id,
        title: serviceRequest.title,
        client: serviceRequest.client,
        service_category: serviceRequest.service_category,
        location: serviceRequest.location,
      }
    };

    // Enviar notificación híbrida al cliente (WebSocket + Push)
    try {
      await this.notificationsService.sendHybridNotification(
        serviceRequest.client.id,
        'nueva_cotizacion',
        {
          title: 'Nueva Cotización Recibida',
          body: `Recibiste una nueva cotización para: ${serviceRequest.service_category.name}`,
          data: {
            type: 'nueva_cotizacion',
            quotation_id: result.quotation.id.toString(),
            service_request_id: service_request_id.toString(),
            intrabbler_name: `${result.quotation.intrabbler.name} ${result.quotation.intrabbler.lastname}`,
            estimated_total: result.quotation.estimated_price.estimated_total.toString(),
            service_category: serviceRequest.service_category.name,
            timestamp: new Date().toISOString()
          }
        },
        {
          priority: 'high', // Importante para el cliente
          websocketCallback: async (userId, event, data) => {
            // Mantener también la notificación a la sala para usuarios que estén viendo en tiempo real
            return await this.appGateway.notifyNewQuotation(service_request_id, notificationData);
          }
        }
      );

      console.log(`🔔 Nueva cotización ${result.quotation.id} notificada híbrida al cliente ${serviceRequest.client.name}`);
    } catch (error) {
      // Don't fail the quotation creation if notification fails
      console.error('Error sending hybrid notification:', error);
    }

    return {
      success: true,
      data: result.quotation,
      message: 'Quotation created successfully'
    };
  }

  async findAll(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const whereCondition = {
      intrabbler_id: userId
    };

    const [quotations, total] = await Promise.all([
      this.prisma.quotations.findMany({
        where: whereCondition,
        include: {
          service_request: {
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  lastname: true,
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
                  address: true,
                  city: true,
                  state: true,
                  country: true,
                }
              }
            }
          },
          estimated_price: true,
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit,
      }),
      this.prisma.quotations.count({
        where: whereCondition,
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: quotations,
      meta: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    };
  }

  async findOne(id: number, userId: string) {
    const quotation = await this.prisma.quotations.findFirst({
      where: {
        id,
        intrabbler_id: userId, // Only allow user to see their own quotations
      },
      include: {
        service_request: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                lastname: true,
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
                address: true,
                city: true,
                state: true,
                country: true,
              }
            }
          }
        },
        estimated_price: true,
      }
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return {
      success: true,
      data: quotation
    };
  }

  async update(id: number, updateQuotationDto: UpdateQuotationDto, userId: string) {
    const quotation = await this.prisma.quotations.findFirst({
      where: {
        id,
        intrabbler_id: userId,
      }
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'pending') {
      throw new BadRequestException('Only pending quotations can be updated');
    }

    const updatedQuotation = await this.prisma.quotations.update({
      where: { id },
      data: updateQuotationDto,
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
    });

    return {
      success: true,
      data: updatedQuotation,
      message: 'Quotation updated successfully'
    };
  }

  async remove(id: number, userId: string) {
    const quotation = await this.prisma.quotations.findFirst({
      where: {
        id,
        intrabbler_id: userId,
      }
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'pending') {
      throw new BadRequestException('Only pending quotations can be deleted');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete the quotation first
      await tx.quotations.delete({
        where: { id }
      });

      // Delete the associated estimated price
      await tx.estimatedPricesQuotations.delete({
        where: { id: quotation.estimated_price_id }
      });
    });

    return {
      success: true,
      message: 'Quotation deleted successfully'
    };
  }

  async acceptQuotation(acceptQuotationData: AcceptQuotationDto & { quotation_id: number }) {
    const { client_id, quotation_id, service_request_id } = acceptQuotationData;

    // Verificar que la solicitud exista y esté activa
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: service_request_id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true,
            is_active: true,
          }
        },
        appointment: true,
      }
    });

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    if (!serviceRequest.is_active) {
      throw new BadRequestException('Service request is not active');
    }

    if (serviceRequest.status !== 'receiving_offers') {
      throw new BadRequestException('Service request is not receiving offers');
    }

    if (serviceRequest.appointment) {
      throw new BadRequestException('Service request already has an appointment');
    }

    if (serviceRequest.client_id !== client_id) {
      throw new ForbiddenException('You are not the owner of this service request');
    }

    if (!serviceRequest.client.is_active) {
      throw new BadRequestException('Client account is not active');
    }

    // Verificar que la cotización exista y no esté cancelada
    const quotation = await this.prisma.quotations.findUnique({
      where: { id: quotation_id },
      include: {
        intrabbler: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true,
            is_active: true,
            intrabbler_profile: {
              select: {
                id: true,
                is_approved: true,
              }
            }
          }
        },
        estimated_price: true,
        service_request: {
          select: {
            id: true,
            preferred_date: true,
            title: true,
            description: true,
            location_address_id: true,
          }
        }
      }
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'pending') {
      throw new BadRequestException('Quotation is not pending');
    }

    if (quotation.service_request_id !== service_request_id) {
      throw new BadRequestException('Quotation does not belong to this service request');
    }

    if (!quotation.intrabbler.is_active) {
      throw new BadRequestException('Intrabbler account is not active');
    }

    if (!quotation.intrabbler.intrabbler_profile?.is_approved) {
      throw new BadRequestException('Intrabbler profile is not approved');
    }

    // Calcular comisión
    const commissionAmount = (quotation.estimated_price.estimated_total * this.COMMISSION_PERCENTAGE) / 100;

    // Verificar el balance de la wallet del aliado
    const aliadoWallet = await this.prisma.wallet.findUnique({
      where: { user_id: quotation.intrabbler.id }
    });

    if (!aliadoWallet) {
      throw new BadRequestException('Intrabbler wallet not found');
    }

    const hasEnoughBalance = aliadoWallet.balance >= commissionAmount;

    // Ejecutar todo en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar la solicitud a offer_accepted
      await tx.serviceRequest.update({
        where: { id: service_request_id },
        data: { status: 'offer_accepted' }
      });

      // 2. Actualizar la cotización a accepted
      await tx.quotations.update({
        where: { id: quotation_id },
        data: { status: 'accepted' }
      });

      // 2.1. Obtener todas las otras cotizaciones pendientes para marcarlas como no seleccionadas
      const otherQuotations = await tx.quotations.findMany({
        where: {
          service_request_id,
          id: { not: quotation_id },
          status: 'pending'
        },
        include: {
          intrabbler: {
            select: {
              id: true,
              name: true,
              lastname: true
            }
          }
        }
      });

      // 2.2. Marcar otras cotizaciones como 'not_selected'
      if (otherQuotations.length > 0) {
        await tx.quotations.updateMany({
          where: {
            service_request_id,
            id: { not: quotation_id },
            status: 'pending'
          },
          data: { status: 'not_selected' }
        });
      }

      // 3. Crear la cita
      let durationMinutes = 0;
      const pricingType = quotation.estimated_price.pricing_type;

      if (pricingType === 'per_hour') {
        durationMinutes = quotation.estimated_price.estimated_unit_quantity * 60;
      } else if (pricingType === 'per_day') {
        durationMinutes = quotation.estimated_price.estimated_unit_quantity * 24 * 60;
      }

      const appointment = await tx.serviceAppointment.create({
        data: {
          appointment_date: quotation.service_request.preferred_date || new Date(),
          status: 'pending',
          client_id: client_id,
          intrabbler_id: quotation.intrabbler.id,
          service_request_id: service_request_id,
          quotation_id: quotation_id,
          location_address_id: quotation.service_request.location_address_id,
          duration_minutes: durationMinutes,
        }
      });

      // 4. Crear el registro de comisión
      const commissionRecord = await tx.commissionRecord.create({
        data: {
          service_appointment_id: appointment.id,
          commission_percentage_due: this.COMMISSION_PERCENTAGE,
          commission_amount_due: commissionAmount,
          commission_percentage_paid: hasEnoughBalance ? this.COMMISSION_PERCENTAGE : 0,
          commission_amount_paid: hasEnoughBalance ? commissionAmount : 0,
          is_paid_full: hasEnoughBalance,
          payment_status: hasEnoughBalance ? 'fully_paid' : 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
          first_payment_at: hasEnoughBalance ? new Date() : null,
          fully_paid_at: hasEnoughBalance ? new Date() : null,
        }
      });

      // 5. Crear la transacción de wallet
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          amount: hasEnoughBalance ? -commissionAmount : -aliadoWallet.balance,
          type: 'adjustment',
          description: hasEnoughBalance 
            ? `Comisión completa por cita #${appointment.id}`
            : `Comisión parcial por cita #${appointment.id}`,
          status: 'completed',
          transaction_id: `COMM_${appointment.id}_${Date.now()}`,
          wallet_id: aliadoWallet.id,
          related_service_appointment_id: appointment.id,
        }
      });

      // 6. Crear el pago de comisión
      const commissionPayment = await tx.commissionPayment.create({
        data: {
          commission_record_id: commissionRecord.id,
          amount_paid: hasEnoughBalance ? commissionAmount : aliadoWallet.balance,
          percentage_paid: hasEnoughBalance ? this.COMMISSION_PERCENTAGE : (aliadoWallet.balance / commissionAmount) * this.COMMISSION_PERCENTAGE,
          payment_method_id: 1, // Asumiendo que 1 es "wallet"
          wallet_transaction_id: walletTransaction.id,
          processed_automatically: true,
          processing_system: 'appointment_creation',
          notes: hasEnoughBalance 
            ? 'Pago completo automático al crear cita'
            : 'Pago parcial automático al crear cita',
        }
      });

      // 7. Actualizar el balance de la wallet
      const newBalance = hasEnoughBalance 
        ? aliadoWallet.balance - commissionAmount
        : 0 - (commissionAmount - aliadoWallet.balance); // Balance negativo

      await tx.wallet.update({
        where: { id: aliadoWallet.id },
        data: { balance: newBalance }
      });

      return {
        appointment,
        commissionRecord,
        commissionPayment,
        walletTransaction,
        newBalance,
        hasEnoughBalance,
        otherQuotations
      };
    });

    // Notificar al aliado SELECCIONADO con sistema híbrido (WebSocket + Push)
    try {
      await this.notificationsService.sendHybridNotification(
        quotation.intrabbler.id,
        'cotizacion_aceptada',
        {
          title: '🎉 ¡Cotización Aceptada!',
          body: `${serviceRequest.client.name} ${serviceRequest.client.lastname} aceptó tu cotización`,
          data: {
            type: 'cotizacion_aceptada',
            quotation_id: quotation_id.toString(),
            service_request_id: service_request_id.toString(),
            appointment_id: result.appointment.id.toString(),
            client_name: `${serviceRequest.client.name} ${serviceRequest.client.lastname}`,
            commission_amount: commissionAmount.toString(),
            appointment_date: result.appointment.appointment_date.toISOString(),
            new_balance: result.newBalance.toString(),
            timestamp: new Date().toISOString()
          }
        },
        {
          priority: 'critical', // ¡Muy importante que se entere!
          websocketCallback: async (userId, event, data) => {
            return await this.appGateway.notifyQuotationAcceptedToIntrabbler(userId, {
              quotation_id,
              service_request_id,
              appointment_id: result.appointment.id,
              message: 'Tu cotización ha sido aceptada y se ha creado una cita',
              appointment_date: result.appointment.appointment_date,
              client: serviceRequest.client,
              commission_charged: result.hasEnoughBalance,
              commission_amount: commissionAmount,
              new_balance: result.newBalance,
            });
          }
        }
      );

      console.log(`✅ Notificación híbrida enviada a aliado seleccionado: ${quotation.intrabbler.name} ${quotation.intrabbler.lastname}`);
    } catch (error) {
      console.error('Error sending accepted quotation notification:', error);
    }

    // Notificar a los aliados NO SELECCIONADOS
    if (result.otherQuotations && result.otherQuotations.length > 0) {
      console.log(`🔔 Notificando a ${result.otherQuotations.length} aliados que sus cotizaciones no fueron seleccionadas...`);

      for (const rejectedQuotation of result.otherQuotations) {
        try {
          await this.notificationsService.sendHybridNotification(
            rejectedQuotation.intrabbler.id,
            'cotizacion_no_seleccionada',
            {
              title: 'Cotización no seleccionada',
              body: 'El cliente eligió otra cotización para su servicio',
              data: {
                type: 'cotizacion_no_seleccionada',
                quotation_id: rejectedQuotation.id,
                service_request_id,
                client_name: `${serviceRequest.client.name} ${serviceRequest.client.lastname}`,
                reason: 'client_selected_other',
                timestamp: new Date().toISOString()
              }
            },
            {
              priority: 'normal',
              websocketCallback: async (userId, event, data) => {
                return await this.appGateway.notifyQuotationNotSelectedToIntrabbler(userId, {
                  quotation_id: rejectedQuotation.id,
                  service_request_id,
                  message: 'El cliente eligió otra cotización para su servicio',
                  client_name: `${serviceRequest.client.name} ${serviceRequest.client.lastname}`,
                  reason: 'client_selected_other',
                  timestamp: new Date().toISOString()
                });
              }
            }
          );

          const aliadoName = `${rejectedQuotation.intrabbler.name} ${rejectedQuotation.intrabbler.lastname}`;
          console.log(`✅ Notificación enviada a ${aliadoName} sobre cotización no seleccionada`);
        } catch (error) {
          console.error(`❌ Error notificando a aliado ${rejectedQuotation.intrabbler.id}:`, error);
        }
      }
    }

    return {
      success: true,
      data: {
        appointment: result.appointment,
        commission_status: result.hasEnoughBalance ? 'fully_paid' : 'partial_paid',
        commission_amount: commissionAmount,
        new_wallet_balance: result.newBalance,
      },
      message: 'Quotation accepted successfully and appointment created'
    };
  }
}