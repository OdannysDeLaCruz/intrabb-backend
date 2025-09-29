import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Request,
  Query,
  HttpStatus,
  HttpException,
  ForbiddenException,
  ParseIntPipe
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { AcceptQuotationDto } from './dto/accept-quotation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('quotations')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  async create(@Body() createQuotationDto: CreateQuotationDto, @Request() req) {
    try {
      // Verify that the user has the role of 'intrabbler'
      const userRole = req.user.role?.name;
      if (userRole !== 'intrabbler') {
        throw new ForbiddenException('Solo los aliados pueden crear cotizaciones');
      }

      const result = await this.quotationsService.create(createQuotationDto, req.user.user_id);
      
      return {
        success: true,
        data: result.data,
        message: result.message
      };
    } catch (error) {
      console.log("EEOR"  , error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error creando cotización',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async findAll(
    @Request() req,
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
            message: 'Page number must be greater than 0'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      if (limitNumber < 1 || limitNumber > 50) {
        throw new HttpException(
          {
            success: false,
            message: 'Limit must be between 1 and 50'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.quotationsService.findAll(req.user.id, pageNumber, limitNumber);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error fetching quotations',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      return await this.quotationsService.findOne(id, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error fetching quotation',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateQuotationDto: UpdateQuotationDto,
    @Request() req
  ) {
    try {
      return await this.quotationsService.update(id, updateQuotationDto, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error updating quotation',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      return await this.quotationsService.remove(id, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error deleting quotation',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/accept')
  async acceptQuotation(
    @Param('id', ParseIntPipe) quotation_id: number,
    @Body() acceptQuotationDto: AcceptQuotationDto,
    @Request() req
  ) {
    try {
      // Verificar que el usuario sea cliente
      const userRole = req.user.role?.name;
      if (userRole !== 'client') {
        throw new ForbiddenException('Solo clientes pueden aceptar cotizaciones');
      }

      // Pasar el quotation_id directamente desde el parámetro
      const completeDto = {
        ...acceptQuotationDto,
        quotation_id,
      };

      return await this.quotationsService.acceptQuotation(completeDto);
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error accepting quotation',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}