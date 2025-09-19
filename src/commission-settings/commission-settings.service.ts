import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionSettingsDto } from './dto/update-commission-settings.dto';

@Injectable()
export class CommissionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.commissionSettings.findMany({
      orderBy: [
        { service_type: 'asc' },
        { created_at: 'desc' }
      ]
    });

    return settings;
  }

  async findByServiceType(serviceType: 'quotation_based' | 'fixed_price') {
    const setting = await this.prisma.commissionSettings.findFirst({
      where: {
        service_type: serviceType,
        is_active: true
      }
    });

    return setting;
  }

  async update(serviceType: 'quotation_based' | 'fixed_price', updateDto: UpdateCommissionSettingsDto) {
    const { commission_percentage, min_commission_amount, max_commission_amount, is_active = true } = updateDto;

    // Validate that max_commission_amount is greater than min_commission_amount if both are provided
    if (min_commission_amount && max_commission_amount && min_commission_amount >= max_commission_amount) {
      throw new BadRequestException('El monto máximo de comisión debe ser mayor al monto mínimo');
    }

    // Check if a setting already exists for this service type
    const existingSetting = await this.prisma.commissionSettings.findFirst({
      where: { service_type: serviceType }
    });

    if (existingSetting) {
      // Update existing setting
      const updatedSetting = await this.prisma.commissionSettings.update({
        where: { id: existingSetting.id },
        data: {
          commission_percentage,
          min_commission_amount,
          max_commission_amount,
          is_active
        }
      });

      return updatedSetting;
    } else {
      // Create new setting
      const newSetting = await this.prisma.commissionSettings.create({
        data: {
          service_type: serviceType,
          commission_percentage,
          min_commission_amount,
          max_commission_amount,
          is_active
        }
      });

      return newSetting;
    }
  }

  async getActiveSettings() {
    const settings = await this.prisma.commissionSettings.findMany({
      where: { is_active: true },
      orderBy: { service_type: 'asc' }
    });

    // Return as an object with service types as keys for easier access
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.service_type] = setting;
      return acc;
    }, {} as Record<string, any>);

    return {
      settings,
      settingsMap
    };
  }

  async calculateCommission(serviceType: 'quotation_based' | 'fixed_price', amount: number) {
    const setting = await this.findByServiceType(serviceType);
    
    if (!setting) {
      throw new NotFoundException(`Configuración de comisión no encontrada para el tipo de servicio: ${serviceType}`);
    }

    // Calculate base commission - convert Decimal to number for arithmetic operations
    const amountAsNumber = typeof amount === 'number' ? amount : Number(amount);
    const commissionPercentageAsNumber = typeof setting.commission_percentage === 'number' ? setting.commission_percentage : Number(setting.commission_percentage);
    const baseCommission = (amountAsNumber * commissionPercentageAsNumber) / 100;

    // Apply min/max limits
    let finalCommission = baseCommission;

    if (setting.min_commission_amount && finalCommission < Number(setting.min_commission_amount)) {
      finalCommission = Number(setting.min_commission_amount);
    }

    if (setting.max_commission_amount && finalCommission > Number(setting.max_commission_amount)) {
      finalCommission = Number(setting.max_commission_amount);
    }

    return {
      service_type: serviceType,
      service_amount: amount,
      commission_percentage: setting.commission_percentage,
      base_commission: baseCommission,
      final_commission: finalCommission,
      min_commission_applied: setting.min_commission_amount ? finalCommission === Number(setting.min_commission_amount) : false,
      max_commission_applied: setting.max_commission_amount ? finalCommission === Number(setting.max_commission_amount) : false,
      settings_used: {
        commission_percentage: setting.commission_percentage,
        min_commission_amount: setting.min_commission_amount,
        max_commission_amount: setting.max_commission_amount
      }
    };
  }

  async initializeDefaultSettings() {
    // Check if settings already exist
    const existingSettings = await this.prisma.commissionSettings.count();
    
    if (existingSettings === 0) {
      // Create default settings for both service types
      const defaultSettings = await this.prisma.commissionSettings.createMany({
        data: [
          {
            service_type: 'quotation_based',
            commission_percentage: 10.0,
            min_commission_amount: 5000,
            max_commission_amount: null,
            is_active: true
          },
          {
            service_type: 'fixed_price',
            commission_percentage: 15.0,
            min_commission_amount: 3000,
            max_commission_amount: null,
            is_active: true
          }
        ]
      });

      return {
        message: 'Configuraciones de comisión inicializadas correctamente',
        settings_created: defaultSettings.count
      };
    }

    return {
      message: 'Las configuraciones de comisión ya existen',
      settings_created: 0
    };
  }
}
