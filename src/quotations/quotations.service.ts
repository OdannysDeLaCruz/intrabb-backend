import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../app/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
    private readonly notificationsService: NotificationsService,
  ) {
  }

  async create(createQuotationDto: CreateQuotationDto, intrabblerUserId: string) {
    const { estimated_price, service_request_id, accept_bonus, ...quotationData } = createQuotationDto;

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
    // const existingQuotation = await this.prisma.quotations.findFirst({
    //   where: {
    //     service_request_id,
    //     intrabbler_id: intrabblerUserId,
    //   }
    // });

    // if (existingQuotation) {
    //   throw new BadRequestException('Ya tienes una cotización para esta solicitud de servicio');
    // }

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

    // Verificar wallet balance y manejar lógica de bono
    const aliado_wallet = await this.prisma.wallet.findUnique({
      where: { user_id: intrabblerUserId },
    });

    if (!aliado_wallet) {
      throw new BadRequestException('Wallet del aliado no encontrada');
    }

    const MAXIMUM_DEBT_ALLOWED = -20000; // COP 20,000 negative balance
    const BONUS_AMOUNT = 20000; // COP 20,000 bonus

    // Obtener configuración de comisión desde la base de datos
    const commissionSettings = await this.prisma.commissionSettings.findFirst({
      where: {
        service_type: 'quotation_based',
        is_active: true,
      },
    });

    if (!commissionSettings) {
      throw new BadRequestException('Configuración de comisiones no encontrada');
    }

    const commissionPercentage = Number(commissionSettings.commission_percentage);

    // Calcular comisión estimada
    const estimatedCommission = (estimated_price.estimated_unit_quantity * estimated_price.estimated_unit_price) * (commissionPercentage / 100);

    // Verificar si está en mora máxima (>= -20000) - NO puede cotizar
    if (aliado_wallet.balance <= MAXIMUM_DEBT_ALLOWED) {
      throw new BadRequestException(`Tienes una mora de COP ${Math.abs(aliado_wallet.balance).toLocaleString('es-CO')} por pagar. Recarga tu cuenta para que puedas enviar esta cotización.`);
    }

    // Casos donde necesita bono pero puede cotizar si lo acepta
    const needsBonus = (aliado_wallet.balance === 0) ||
                       (aliado_wallet.balance > 0 && aliado_wallet.balance < estimatedCommission);

    // Verificar si después de descontar la comisión superaría el límite de deuda
    const balanceAfterCommission = aliado_wallet.balance - estimatedCommission;

    if (balanceAfterCommission < MAXIMUM_DEBT_ALLOWED) {
      const debtExcess = Math.abs(balanceAfterCommission - MAXIMUM_DEBT_ALLOWED);
      throw new BadRequestException(
        `Tu saldo actual es COP ${aliado_wallet.balance.toLocaleString('es-CO')}, ` +
        `la comisión es COP ${estimatedCommission.toLocaleString('es-CO')}, lo que te dejaría en COP ${balanceAfterCommission.toLocaleString('es-CO')}. ` +
        `Tu cupo bono te permite cotizar hasta COP ${Math.abs(MAXIMUM_DEBT_ALLOWED).toLocaleString('es-CO')}. Recarga tu cuenta con al menos COP ${debtExcess.toLocaleString('es-CO')}.`
      );
    }

    // Casos donde ya tiene deuda pero puede cotizar (ya recibió bono anteriormente)
    const hasDebtButCanQuote = aliado_wallet.balance < 0 && balanceAfterCommission >= MAXIMUM_DEBT_ALLOWED;
    console.log("needsBonus", needsBonus)
    console.log("accept_bonus", accept_bonus)
    console.log("needsBonus && !accept_bonus", needsBonus && !accept_bonus)
    console.log("hasDebtButCanQuote", hasDebtButCanQuote)
    if (needsBonus && !accept_bonus) {
      // El aliado puede usar un cupo de cotizaciones adelantadas
      const message = aliado_wallet.balance === 0
        ? `No tienes saldo suficiente para la comisión. Puedes usar tu cupo de cotizaciones adelantadas de COP ${BONUS_AMOUNT.toLocaleString('es-CO')} para enviar esta cotización. Podrás pagarlo luego recargando tu cuenta o con los pagos recibidos.`
        : `Tu saldo actual (COP ${aliado_wallet.balance.toLocaleString('es-CO')}) no es suficiente para la comisión estimada (COP ${estimatedCommission.toLocaleString('es-CO')}). Puedes usar tu cupo de cotizaciones adelantadas de COP ${BONUS_AMOUNT.toLocaleString('es-CO')} para completar esta cotización. Podrás pagarlo luego recargando tu cuenta o con los pagos recibidos.`;
      console.log('::::::::::::::::::::::', message);
      throw new BadRequestException({
        message,
        error_code: 'BONUS_OFFER_AVAILABLE',
        status_code: 400,
        bonus_amount: BONUS_AMOUNT,
        current_balance: aliado_wallet.balance,
        commission_required: estimatedCommission
      });
    }

    // Determinar escenario de cobro
    const hasEnoughBalance = aliado_wallet.balance >= estimatedCommission;
    const usingBonus = needsBonus && accept_bonus;

    // Calcular duration_minutes para el appointment
    // let durationMinutes = 60; // default
    // if (estimated_price.pricing_type === 'per_hour') {
    //   durationMinutes = estimated_price.estimated_unit_quantity * 60;
    // } else if (estimated_price.pricing_type === 'per_day') {
    //   durationMinutes = estimated_price.estimated_unit_quantity * 24 * 60;
    // }

    // Create the quotation in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the estimated price first
      const estimatedPrice = await tx.estimatedPricesQuotations.create({
        data: {
          estimated_unit_quantity: estimated_price.estimated_unit_quantity,
          estimated_unit_price: estimated_price.estimated_unit_price,
          estimated_total: estimated_price.estimated_unit_quantity * estimated_price.estimated_unit_price,
          pricing_type: estimated_price.pricing_type,
        }
      });

      // 2. Create the quotation
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

      // 3. Create QuotationCommission (NO ServiceAppointment yet)
      const quotationCommission = await tx.quotationCommission.create({
        data: {
          quotation_id: quotation.id,
          commission_percentage_due: commissionPercentage,
          commission_amount_due: estimatedCommission,
          commission_percentage_paid: commissionPercentage,
          commission_amount_paid: estimatedCommission,
          is_paid: true,
          payment_status: 'fully_paid',
          paid_at: new Date(),
          notes: hasEnoughBalance
            ? 'Pago completo automático al crear cotización'
            : 'Pago con cupo aplicado al crear cotización',
        }
      });

      // 4. Create WalletTransaction for commission
      const description = hasEnoughBalance
        ? `Comisión por cotización #${quotation.id}`
        : `Comisión por cotización con cupo aplicado - Cotización #${quotation.id}`;

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          amount: -estimatedCommission,
          type: 'adjustment',
          description,
          status: 'completed',
          transaction_id: `COMM_QUOT_${quotation.id}_${Date.now()}`,
          wallet_id: aliado_wallet.id,
          related_service_appointment_id: null, // No hay appointment aún
        }
      });

      // 5. Vincular transacción con comisión
      await tx.quotationCommission.update({
        where: { id: quotationCommission.id },
        data: { wallet_transaction_id: walletTransaction.id }
      });

      // 6. Update Wallet balance
      const newBalance = aliado_wallet.balance - estimatedCommission;
      await tx.wallet.update({
        where: { id: aliado_wallet.id },
        data: { balance: newBalance }
      });

      return {
        quotation,
        estimatedPrice,
        quotationCommission,
        walletTransaction,
        newBalance,
        usingBonus
      };
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
          websocketCallback: async () => {
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
      },
      include: {
        service_appointment: true,
      }
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'pending') {
      throw new BadRequestException('Only pending quotations can be deleted');
    }

    // Devolver comisión antes de eliminar
    await this.refundQuotationCommission(quotation.id);

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

  /**
   * Devuelve la comisión cobrada cuando una cotización no es seleccionada
   */
  private async refundQuotationCommission(quotation_id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Buscar QuotationCommission
      const quotationCommission = await tx.quotationCommission.findUnique({
        where: { quotation_id },
        include: {
          quotation: {
            include: {
              intrabbler: {
                include: { wallet: true }
              }
            }
          },
          wallet_transaction: true
        }
      });

      if (!quotationCommission) {
        return; // No hay comisión que devolver
      }

      const amountToRefund = quotationCommission.commission_amount_paid;

      if (amountToRefund <= 0) {
        // No hay monto pagado que devolver
        return;
      }

      const walletId = quotationCommission.quotation.intrabbler.wallet.id;

      // 2. Crear WalletTransaction de devolución
      await tx.walletTransaction.create({
        data: {
          amount: amountToRefund, // POSITIVO
          type: 'refund',
          description: `Devolución de comisión - Cotización no seleccionada`,
          status: 'completed',
          transaction_id: `REFUND_QUOT_${quotation_id}_${Date.now()}`,
          wallet_id: walletId,
          related_service_appointment_id: null, // No hay appointment
        }
      });

      // 3. Actualizar Wallet balance (devolver dinero)
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            increment: amountToRefund
          }
        }
      });

      // 4. Actualizar QuotationCommission
      await tx.quotationCommission.update({
        where: { id: quotationCommission.id },
        data: {
          commission_amount_paid: 0,
          commission_percentage_paid: 0,
          is_paid: false,
          payment_status: 'refunded',
          refunded_at: new Date()
        }
      });
    });
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
        }
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

    // if (serviceRequest.appointment) {
    //   throw new BadRequestException('Service request already has an appointment');
    // }

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

    // Validar que no existe cita activa para esta solicitud
    const existingActiveAppointment = await this.prisma.serviceAppointment.findFirst({
      where: {
        service_request_id,
        is_active: true
      }
    });

    if (existingActiveAppointment) {
      throw new ConflictException(
        'Tienes una cita activa. Debes cancelarla antes de aceptar otra cotización.'
      );
    }

    // Calcular duration_minutes para el appointment (copiado del método create)
    let durationMinutes = 60; // default
    if (quotation.estimated_price.pricing_type === 'per_hour') {
      durationMinutes = quotation.estimated_price.estimated_unit_quantity * 60;
    } else if (quotation.estimated_price.pricing_type === 'per_day') {
      durationMinutes = quotation.estimated_price.estimated_unit_quantity * 24 * 60;
    }

    // Obtener QuotationCommission
    const quotationCommission = await this.prisma.quotationCommission.findUnique({
      where: { quotation_id }
    });

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

      // 3. Crear ServiceAppointment (NUEVO - antes no existía)
      const appointment = await tx.serviceAppointment.create({
        data: {
          appointment_date: quotation.service_request.preferred_date || new Date(),
          duration_minutes: durationMinutes,
          status: 'pending',
          is_active: true,
          client_id: serviceRequest.client_id,
          intrabbler_id: quotation.intrabbler.id,
          service_request_id,
          quotation_id,
          location_address_id: quotation.service_request.location_address_id,
        }
      });

      // 4. Crear CommissionRecord (vinculado al nuevo appointment)
      if (quotationCommission) {
        await tx.commissionRecord.create({
          data: {
            service_appointment_id: appointment.id,
            commission_percentage_due: quotationCommission.commission_percentage_due,
            commission_amount_due: quotationCommission.commission_amount_due,
            commission_percentage_paid: quotationCommission.commission_percentage_paid,
            commission_amount_paid: quotationCommission.commission_amount_paid,
            is_paid_full: true,
            payment_status: 'fully_paid',
            first_payment_at: quotationCommission.paid_at || new Date(),
            fully_paid_at: quotationCommission.paid_at || new Date(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
          }
        });
      }

      // 5. Obtener todas las otras cotizaciones pendientes para marcarlas como no seleccionadas
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

      // 6. Marcar otras cotizaciones como 'not_selected'
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

      return {
        appointment,
        otherQuotations
      };
    });

    // Devolver comisiones de cotizaciones no seleccionadas
    if (result.otherQuotations && result.otherQuotations.length > 0) {
      for (const rejectedQuotation of result.otherQuotations) {
        // Refundar comisión por ID de cotización (no por appointment)
        await this.refundQuotationCommission(rejectedQuotation.id);
      }
    }

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
            appointment_date: result.appointment.appointment_date.toISOString(),
            timestamp: new Date().toISOString()
          }
        },
        {
          priority: 'critical', // ¡Muy importante que se entere!
          websocketCallback: async (userId) => {
            return await this.appGateway.notifyQuotationAcceptedToIntrabbler(userId, {
              quotation_id,
              service_request_id,
              appointment_id: result.appointment.id,
              message: 'Tu cotización ha sido aceptada',
              appointment_date: result.appointment.appointment_date,
              client: serviceRequest.client,
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
              websocketCallback: async (userId) => {
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
      },
      message: 'Quotation accepted successfully'
    };
  }

  /**
   * Cancela una cita y reembolsa la comisión asociada
   */
  async cancelAppointment(appointmentId: number, userId: string, cancellationReason?: string) {
    // 1. Buscar el appointment
    const appointment = await this.prisma.serviceAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: { select: { id: true } },
        intrabbler: { select: { id: true, name: true, lastname: true } },
        quotation: { select: { id: true } },
        commission_record: {
          include: {
            service_appointment: {
              select: { quotation_id: true }
            }
          }
        }
      }
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // 2. Validar que el usuario que cancela es el cliente
    if (appointment.client.id !== userId) {
      throw new ForbiddenException('Only the client can cancel this appointment');
    }

    // 3. Validar que la cita está activa
    if (!appointment.is_active) {
      throw new BadRequestException('This appointment is not active');
    }

    // 4. Ejecutar en transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 4a. Actualizar appointment a cancelled
      const cancelledAppointment = await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          is_active: false,
          status: 'cancelled',
          cancelation_reason: cancellationReason || 'Cancelled by client',
          cancelation_at: new Date()
        }
      });

      // 4b. Si existe CommissionRecord, reembolsar comisión
      if (appointment.commission_record && appointment.quotation) {
        const commissionRecord = appointment.commission_record;
        const amountToRefund = commissionRecord.commission_amount_paid;

        if (amountToRefund > 0) {
          // Buscar QuotationCommission para actualizar
          const quotationCommission = await tx.quotationCommission.findUnique({
            where: { quotation_id: appointment.quotation.id },
            include: {
              quotation: {
                include: {
                  intrabbler: {
                    include: { wallet: true }
                  }
                }
              }
            }
          });

          if (quotationCommission) {
            const walletId = quotationCommission.quotation.intrabbler.wallet.id;

            // Crear WalletTransaction de devolución
            await tx.walletTransaction.create({
              data: {
                amount: amountToRefund, // POSITIVO
                type: 'refund',
                description: `Devolución de comisión - Cita cancelada por el cliente`,
                status: 'completed',
                transaction_id: `REFUND_APPT_${appointmentId}_${Date.now()}`,
                wallet_id: walletId,
                related_service_appointment_id: appointmentId,
              }
            });

            // Actualizar Wallet balance
            await tx.wallet.update({
              where: { id: walletId },
              data: {
                balance: {
                  increment: amountToRefund
                }
              }
            });

            // Actualizar QuotationCommission
            await tx.quotationCommission.update({
              where: { id: quotationCommission.id },
              data: {
                commission_amount_paid: 0,
                commission_percentage_paid: 0,
                is_paid: false,
                payment_status: 'refunded',
                refunded_at: new Date()
              }
            });

            // Actualizar CommissionRecord
            await tx.commissionRecord.update({
              where: { id: commissionRecord.id },
              data: {
                commission_amount_paid: 0,
                commission_percentage_paid: 0,
                is_paid_full: false,
                payment_status: 'waived'
              }
            });
          }
        }
      }

      return cancelledAppointment;
    });

    // 5. Enviar notificación al aliado
    try {
      await this.notificationsService.sendHybridNotification(
        appointment.intrabbler.id,
        'cita_cancelada',
        {
          title: '❌ Cita Cancelada',
          body: `El cliente canceló la cita. Tu comisión ha sido reembolsada.`,
          data: {
            type: 'cita_cancelada',
            appointment_id: appointmentId.toString(),
            reason: cancellationReason || 'Cancelled by client',
            timestamp: new Date().toISOString()
          }
        },
        {
          priority: 'high',
          websocketCallback: async (userId) => {
            return await this.appGateway.notifyAliado(userId, 'cita_cancelada', {
              appointment_id: appointmentId,
              message: 'Tu cita ha sido cancelada por el cliente',
              reason: cancellationReason || 'Cancelled by client',
              commission_refunded: true
            });
          }
        }
      );

      console.log(`✅ Notificación de cita cancelada enviada a aliado: ${appointment.intrabbler.name} ${appointment.intrabbler.lastname}`);
    } catch (error) {
      console.error('Error sending appointment cancellation notification:', error);
    }

    return {
      success: true,
      data: {
        appointment: result,
      },
      message: 'Appointment cancelled successfully and commission refunded'
    };
  }
}