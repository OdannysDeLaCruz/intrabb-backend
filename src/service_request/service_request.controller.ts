import { Controller, Get, Post, Body, Param, HttpException, HttpStatus, Patch, Query } from '@nestjs/common';
import { ServiceRequestService } from './service_request.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ServiceRequestStatus } from '@prisma/client';
import { Public } from 'src/common/decorators';

@Controller('service-requests')
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  @Post()
  @Public()
  async create(@Body() createServiceRequestDto: CreateServiceRequestDto) {
    try {
      const serviceRequest = await this.serviceRequestService.create(createServiceRequestDto);
      return {
        success: true,
        data: serviceRequest,
        message: 'Solicitud de servicio creada exitosamente'
      };
    } catch (error) {
      console.log(error);
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

  @Get('availables')
  async findAvailableOpportunities(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('location') location?: string
  ) {
    try {
      const pageNumber = page ? parseInt(page, 10) : 1;
      const limitNumber = limit ? parseInt(limit, 10) : 10;
      const categoryIdNumber = categoryId ? parseInt(categoryId, 10) : undefined;

      // Validate pagination parameters
      if (pageNumber < 1) {
        throw new HttpException(
          {
            success: false,
            message: 'El número de página debe ser mayor a 0'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      if (limitNumber < 1 || limitNumber > 50) {
        throw new HttpException(
          {
            success: false,
            message: 'El límite debe estar entre 1 y 50'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.serviceRequestService.findAvailableOpportunities(
        pageNumber,
        limitNumber,
        categoryIdNumber,
        location
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error al obtener las oportunidades disponibles',
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
  async findByClientId(
    @Param('clientId') clientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const pageNumber = page ? parseInt(page, 10) : 1;
      const limitNumber = limit ? parseInt(limit, 10) : 10;

      // Validate pagination parameters
      if (pageNumber < 1) {
        throw new HttpException(
          {
            success: false,
            message: 'El número de página debe ser mayor a 0'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      if (limitNumber < 1 || limitNumber > 50) {
        throw new HttpException(
          {
            success: false,
            message: 'El límite debe estar entre 1 y 50'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.serviceRequestService.findByClientId(
        clientId, 
        pageNumber, 
        limitNumber
      );
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
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
