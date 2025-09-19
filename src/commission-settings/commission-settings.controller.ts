import { Controller, Get, Put, Body, Param, UseGuards, Post } from '@nestjs/common';
import { CommissionSettingsService } from './commission-settings.service';
import { UpdateCommissionSettingsDto } from './dto/update-commission-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Commission Settings')
@Controller('v1/commission-settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommissionSettingsController {
  constructor(private readonly commissionSettingsService: CommissionSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración actual de comisiones' })
  @ApiResponse({ status: 200, description: 'Configuraciones de comisión actuales' })
  async findAll() {
    return this.commissionSettingsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener solo las configuraciones activas' })
  @ApiResponse({ status: 200, description: 'Configuraciones de comisión activas' })
  async getActiveSettings() {
    return this.commissionSettingsService.getActiveSettings();
  }

  @Get('service-type/:serviceType')
  @ApiOperation({ summary: 'Obtener configuración por tipo de servicio' })
  @ApiResponse({ status: 200, description: 'Configuración de comisión para el tipo de servicio' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async findByServiceType(@Param('serviceType') serviceType: 'quotation_based' | 'fixed_price') {
    return this.commissionSettingsService.findByServiceType(serviceType);
  }

  @Put('service-type/:serviceType')
  @ApiOperation({ summary: 'Actualizar configuración de comisiones (solo admin)' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async update(
    @Param('serviceType') serviceType: 'quotation_based' | 'fixed_price',
    @Body() updateCommissionSettingsDto: UpdateCommissionSettingsDto
  ) {
    return this.commissionSettingsService.update(serviceType, updateCommissionSettingsDto);
  }

  @Post('calculate/:serviceType')
  @ApiOperation({ summary: 'Calcular comisión para un monto específico' })
  @ApiResponse({ status: 200, description: 'Cálculo de comisión realizado' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async calculateCommission(
    @Param('serviceType') serviceType: 'quotation_based' | 'fixed_price',
    @Body() body: { amount: number }
  ) {
    return this.commissionSettingsService.calculateCommission(serviceType, body.amount);
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Inicializar configuraciones por defecto (solo admin)' })
  @ApiResponse({ status: 201, description: 'Configuraciones inicializadas exitosamente' })
  @ApiResponse({ status: 200, description: 'Las configuraciones ya existen' })
  async initializeDefaultSettings() {
    return this.commissionSettingsService.initializeDefaultSettings();
  }
}
