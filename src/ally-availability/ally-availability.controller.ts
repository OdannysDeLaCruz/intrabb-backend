import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AllyAvailabilityService } from './ally-availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Ally Availability')
@Controller('v1/ally-availability')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AllyAvailabilityController {
  constructor(private readonly allyAvailabilityService: AllyAvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo horario de disponibilidad' })
  @ApiResponse({ status: 201, description: 'Horario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o horarios superpuestos' })
  @ApiResponse({ status: 403, description: 'No autorizado para configurar horarios' })
  async create(@Body() createAvailabilityDto: CreateAvailabilityDto, @Req() req: any) {
    const intrabblerUserId = req.user.id;
    return this.allyAvailabilityService.create(createAvailabilityDto, intrabblerUserId);
  }

  @Get(':intrabberId')
  @ApiOperation({ summary: 'Obtener horarios configurados del aliado' })
  @ApiResponse({ status: 200, description: 'Horarios de disponibilidad del aliado' })
  async findByIntrabbler(@Param('intrabberId') intrabberId: string) {
    return this.allyAvailabilityService.findByIntrabbler(intrabberId);
  }

  @Put(':intrabberId')
  @ApiOperation({ summary: 'Actualizar horarios completos del aliado' })
  @ApiResponse({ status: 200, description: 'Horarios actualizados exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o horarios superpuestos' })
  @ApiResponse({ status: 403, description: 'No autorizado para actualizar horarios' })
  async updateAll(@Param('intrabberId') intrabberId: string, @Body() updateAvailabilityDto: UpdateAvailabilityDto, @Req() req: any) {
    const requestUserId = req.user.id;
    
    // Verify that the user can only update their own availability
    if (requestUserId !== intrabberId) {
      throw new Error('Solo puedes actualizar tus propios horarios');
    }
    
    return this.allyAvailabilityService.updateAll(updateAvailabilityDto, intrabberId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un horario específico' })
  @ApiResponse({ status: 200, description: 'Horario eliminado exitosamente' })
  @ApiResponse({ status: 403, description: 'No autorizado para eliminar este horario' })
  @ApiResponse({ status: 404, description: 'Horario no encontrado' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const intrabblerUserId = req.user.id;
    return this.allyAvailabilityService.remove(+id, intrabblerUserId);
  }

  @Get(':intrabberId/summary')
  @ApiOperation({ summary: 'Resumen de disponibilidad para mostrar en perfil' })
  @ApiResponse({ status: 200, description: 'Resumen de disponibilidad del aliado' })
  async getSummary(@Param('intrabberId') intrabberId: string) {
    return this.allyAvailabilityService.getSummary(intrabberId);
  }

  @Get(':intrabberId/has-availability')
  @ApiOperation({ summary: 'Verificar si el aliado tiene horarios configurados' })
  @ApiResponse({ status: 200, description: 'Estado de disponibilidad del aliado' })
  async hasAvailability(@Param('intrabberId') intrabberId: string) {
    const hasAvailability = await this.allyAvailabilityService.hasAvailability(intrabberId);
    return { 
      intrabbler_id: intrabberId,
      has_availability: hasAvailability 
    };
  }
}
