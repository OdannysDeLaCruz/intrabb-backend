import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SelectApplicationDto } from './dto/select-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Applications')
@Controller('v1/applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva aplicación para servicio de precio fijo' })
  @ApiResponse({ status: 201, description: 'Aplicación creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 403, description: 'No autorizado para aplicar' })
  async create(@Body() createApplicationDto: CreateApplicationDto, @Req() req: any) {
    const intrabblerUserId = req.user.id;
    return this.applicationsService.create(createApplicationDto, intrabblerUserId);
  }

  @Get('service-request/:serviceRequestId')
  @ApiOperation({ summary: 'Obtener aplicaciones para una solicitud específica' })
  @ApiResponse({ status: 200, description: 'Lista de aplicaciones para la solicitud' })
  async findByServiceRequest(@Param('serviceRequestId') serviceRequestId: string) {
    return this.applicationsService.findByServiceRequest(+serviceRequestId);
  }

  @Get('intrabbler/:intrabberId')
  @ApiOperation({ summary: 'Obtener aplicaciones del aliado' })
  @ApiResponse({ status: 200, description: 'Lista de aplicaciones del aliado' })
  async findByIntrabbler(@Param('intrabberId') intrabberId: string) {
    return this.applicationsService.findByIntrabbler(intrabberId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener aplicación por ID' })
  @ApiResponse({ status: 200, description: 'Detalles de la aplicación' })
  @ApiResponse({ status: 404, description: 'Aplicación no encontrada' })
  async findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(+id);
  }

  @Patch(':id/select')
  @ApiOperation({ summary: 'Cliente selecciona un aliado' })
  @ApiResponse({ status: 200, description: 'Aliado seleccionado exitosamente' })
  @ApiResponse({ status: 400, description: 'No se puede seleccionar esta aplicación' })
  @ApiResponse({ status: 403, description: 'No autorizado para seleccionar' })
  async selectApplication(@Param('id') id: string, @Req() req: any) {
    const clientUserId = req.user.id;
    const selectDto: SelectApplicationDto = { application_id: +id };
    return this.applicationsService.selectApplication(selectDto, clientUserId);
  }
}
