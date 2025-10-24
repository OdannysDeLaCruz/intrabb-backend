import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
// import { CreateUserDto } from '../auth/dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create();
  // }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.usersService.update(id, updateUserDto);
      return {
        success: true,
        data: user,
        message: 'User updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error updating user',
        error: error.message
      };
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Get(':id/addresses')
  async getUserAddresses(@Param('id') id: string) {
    try {
      const addresses = await this.usersService.getUserAddresses(id);
      return {
        success: true,
        data: addresses,
        message: 'Addresses retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving addresses',
        error: error.message
      };
    }
  }

  @Post(':id/addresses')
  async saveUserAddress(
    @Param('id') id: string,
    @Body() createAddressDto: CreateAddressDto
  ) {
    try {
      const address = await this.usersService.saveUserAddress(id, createAddressDto);
      return {
        success: true,
        data: address,
        message: 'Address saved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error saving address',
        error: error.message
      };
    }
  }

  @Get(':id/quotations')
  async getUserQuotations(@Param('id') id: string) {
    try {
      const quotations = await this.usersService.getUserQuotations(id);
      return {
        success: true,
        data: quotations,
        message: 'Quotations retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving quotations',
        error: error.message
      };
    }
  }

  @Get(':id/appointments')
  async getUserAppointments(@Param('id') id: string) {
    try {
      const appointments = await this.usersService.getUserAppointments(id);
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
      const appointment = await this.usersService.getAppointmentDetail(id, appointmentId);
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
}
