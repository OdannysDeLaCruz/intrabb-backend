import { Controller, Post, Body, Request, Get, Param, Patch } from '@nestjs/common';
import { IntrabblersService } from './intrabblers.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { CanQuoteResponseDto } from './dto/can-quote-response.dto';

@Controller('intrabblers')
export class IntrabblersController {
  constructor(private readonly intrabblersService: IntrabblersService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    const userId = req.user.id;
    const result = await this.intrabblersService.getProfile(userId);
    
    return {
      success: true,
      data: result
    };
  }

  @Post('complete-profile')
  async completeProfile(@Request() req, @Body() completeProfileDto: CompleteProfileDto) {
    const userId = req.user.id;
    const result = await this.intrabblersService.completeProfile(userId, completeProfileDto);
    
    return {
      success: true,
      message: 'Perfil profesional completado exitosamente',
      data: result
    };
  }

  @Patch(':id/approve')
  async approveProfile(@Param('id') id: string) {
    const result = await this.intrabblersService.approveProfile(id);
    
    return {
      success: true,
      message: 'Perfil aprobado exitosamente',
      data: result
    };
  }

  @Get(':id/appointments')
  async getUserAppointments(@Param('id') id: string) {
    try {
      const appointments = await this.intrabblersService.getUserAppointments(id);
      return {
        success: true,
        data: appointments,
        message: 'Appointments retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving appointments',
        error: error.message
      };
    }
  }

  @Get(':id/appointments/:appointmentId')
  async getAppointmentDetail(@Param('id') id: string, @Param('appointmentId') appointmentId: string) {
    try {
      const appointment = await this.intrabblersService.getAppointmentDetail(id, appointmentId);
      return {
        success: true,
        data: appointment,
        message: 'Appointment detail retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving appointment detail',
        error: error.message
      };
    }
  }

  @Patch(':id/appointments/:appointmentId/status')
  async updateAppointmentStatus(
    @Param('id') id: string, 
    @Param('appointmentId') appointmentId: string,
    @Body() updateStatusDto: UpdateAppointmentStatusDto
  ) {
    try {
      const appointment = await this.intrabblersService.updateAppointmentStatus(id, appointmentId, updateStatusDto);
      return {
        success: true,
        data: appointment,
        message: 'Estado de la cita actualizado exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al actualizar el estado de la cita',
        error: error.message
      };
    }
  }

  @Post(':id/appointments/:appointmentId/incidents')
  async reportIncident(
    @Param('id') id: string,
    @Param('appointmentId') appointmentId: string,
    @Body() reportIncidentDto: ReportIncidentDto
  ) {
    try {
      const incident = await this.intrabblersService.reportIncident(id, appointmentId, reportIncidentDto);
      return {
        success: true,
        data: incident,
        message: 'Incidente reportado exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al reportar el incidente',
        error: error.message
      };
    }
  }

  @Get(':id/can-quote')
  async canQuote(@Param('id') id: string): Promise<{ success: boolean; data: CanQuoteResponseDto; message: string }> {
    try {
      const result = await this.intrabblersService.canQuote(id);
      return {
        success: true,
        data: result,
        message: 'Verificación completada'
      };
    } catch (error) {
      throw error;
    }
  }
}