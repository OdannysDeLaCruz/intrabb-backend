import { Controller, Get, Post, Body, Param, HttpException, HttpStatus, Patch } from '@nestjs/common';
import { ServiceRequestService } from './service_request.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ServiceRequestStatus } from '@prisma/client';

@Controller('service-request')
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  @Post()
  async create(@Body() createServiceRequestDto: CreateServiceRequestDto) {
    try {
      const serviceRequest = await this.serviceRequestService.create(createServiceRequestDto);
      return {
        success: true,
        data: serviceRequest,
        message: 'Solicitud de servicio creada exitosamente'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Error al crear la solicitud de servicio',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const serviceRequest = await this.serviceRequestService.findOne(+id);
      if (!serviceRequest) {
        throw new HttpException(
          {
            success: false,
            message: 'Solicitud de servicio no encontrada'
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: serviceRequest
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error al obtener la solicitud de servicio',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('client/:clientId')
  async findByClientId(@Param('clientId') clientId: string) {
    try {
      const serviceRequests = await this.serviceRequestService.findByClientId(clientId);
      return {
        success: true,
        data: serviceRequests
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Error al obtener las solicitudes de servicio',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: { status: ServiceRequestStatus }
  ) {
    try {
      const serviceRequest = await this.serviceRequestService.updateStatus(+id, updateStatusDto.status);
      return {
        success: true,
        data: serviceRequest,
        message: 'Estado de la solicitud actualizado exitosamente'
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Error al actualizar el estado de la solicitud',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
