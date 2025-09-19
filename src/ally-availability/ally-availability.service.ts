import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class AllyAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private validateTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private validateTimeSlot(start_time: string, end_time: string): void {
    if (!this.validateTimeFormat(start_time) || !this.validateTimeFormat(end_time)) {
      throw new BadRequestException('El formato de hora debe ser HH:mm (ej: 09:00, 18:30)');
    }

    const [startHour, startMinute] = start_time.split(':').map(Number);
    const [endHour, endMinute] = end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    // Minimum slot duration: 1 hour (60 minutes)
    if (endMinutes - startMinutes < 60) {
      throw new BadRequestException('La duración mínima del horario de disponibilidad es de 1 hora');
    }
  }

  private checkOverlappingSlots(slots: CreateAvailabilityDto[]): void {
    // Group by day of week
    const slotsByDay = slots.reduce((acc, slot) => {
      if (!acc[slot.day_of_week]) {
        acc[slot.day_of_week] = [];
      }
      acc[slot.day_of_week].push(slot);
      return acc;
    }, {} as Record<number, CreateAvailabilityDto[]>);

    // Check for overlaps within each day
    Object.entries(slotsByDay).forEach(([day, daySlots]) => {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          const slot1 = daySlots[i];
          const slot2 = daySlots[j];

          const [start1Hour, start1Minute] = slot1.start_time.split(':').map(Number);
          const [end1Hour, end1Minute] = slot1.end_time.split(':').map(Number);
          const [start2Hour, start2Minute] = slot2.start_time.split(':').map(Number);
          const [end2Hour, end2Minute] = slot2.end_time.split(':').map(Number);

          const start1Minutes = start1Hour * 60 + start1Minute;
          const end1Minutes = end1Hour * 60 + end1Minute;
          const start2Minutes = start2Hour * 60 + start2Minute;
          const end2Minutes = end2Hour * 60 + end2Minute;

          // Check for overlap
          if (
            (start1Minutes < end2Minutes && end1Minutes > start2Minutes) ||
            (start2Minutes < end1Minutes && end2Minutes > start1Minutes)
          ) {
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dayName = dayNames[parseInt(day)];
            throw new BadRequestException(
              `Se encontraron horarios superpuestos para ${dayName}: ${slot1.start_time}-${slot1.end_time} y ${slot2.start_time}-${slot2.end_time}`
            );
          }
        }
      }
    });
  }

  async create(createAvailabilityDto: CreateAvailabilityDto, intrabblerUserId: string) {
    const { day_of_week, start_time, end_time, is_active = true } = createAvailabilityDto;

    // Verify that the user is an approved intrabbler
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: intrabblerUserId }
    });

    if (!intrabblerProfile || !intrabblerProfile.is_approved) {
      throw new ForbiddenException('Debes ser un profesional aprobado para configurar tu disponibilidad');
    }

    // Validate time format and slot
    this.validateTimeSlot(start_time, end_time);

    // Check for existing overlapping slots
    const existingSlots = await this.prisma.allyAvailability.findMany({
      where: {
        intrabbler_id: intrabblerUserId,
        day_of_week,
        is_active: true
      }
    });

    const newSlots = [...existingSlots.map(slot => ({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_active: slot.is_active
    })), createAvailabilityDto];

    this.checkOverlappingSlots(newSlots);

    // Create the availability slot
    const availability = await this.prisma.allyAvailability.create({
      data: {
        intrabbler_id: intrabblerUserId,
        day_of_week,
        start_time,
        end_time,
        is_active
      }
    });

    return availability;
  }

  async findByIntrabbler(intrabblerUserId: string) {
    const availability = await this.prisma.allyAvailability.findMany({
      where: { intrabbler_id: intrabblerUserId },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' }
      ]
    });

    // Group by day of week for easier consumption
    const groupedAvailability = availability.reduce((acc, slot) => {
      if (!acc[slot.day_of_week]) {
        acc[slot.day_of_week] = [];
      }
      acc[slot.day_of_week].push(slot);
      return acc;
    }, {} as Record<number, typeof availability>);

    return {
      raw: availability,
      grouped: groupedAvailability
    };
  }

  async updateAll(updateAvailabilityDto: UpdateAvailabilityDto, intrabblerUserId: string) {
    const { availability_slots } = updateAvailabilityDto;

    // Verify that the user is an approved intrabbler
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: intrabblerUserId }
    });

    if (!intrabblerProfile || !intrabblerProfile.is_approved) {
      throw new ForbiddenException('Debes ser un profesional aprobado para configurar tu disponibilidad');
    }

    // Validate all time slots
    availability_slots.forEach(slot => {
      this.validateTimeSlot(slot.start_time, slot.end_time);
    });

    // Check for overlapping slots
    this.checkOverlappingSlots(availability_slots);

    // Use transaction to replace all availability slots
    const result = await this.prisma.$transaction(async (prisma) => {
      // Delete existing slots
      await prisma.allyAvailability.deleteMany({
        where: { intrabbler_id: intrabblerUserId }
      });

      // Create new slots
      const newSlots = await Promise.all(
        availability_slots.map(slot =>
          prisma.allyAvailability.create({
            data: {
              intrabbler_id: intrabblerUserId,
              day_of_week: slot.day_of_week,
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_active: slot.is_active ?? true
            }
          })
        )
      );

      return newSlots;
    });

    return result;
  }

  async remove(id: number, intrabblerUserId: string) {
    // Find the availability slot
    const availability = await this.prisma.allyAvailability.findUnique({
      where: { id }
    });

    if (!availability) {
      throw new NotFoundException('Horario de disponibilidad no encontrado');
    }

    // Verify ownership
    if (availability.intrabbler_id !== intrabblerUserId) {
      throw new ForbiddenException('Solo puedes eliminar tus propios horarios de disponibilidad');
    }

    return await this.prisma.allyAvailability.delete({
      where: { id }
    });
  }

  async getSummary(intrabblerUserId: string) {
    const availability = await this.prisma.allyAvailability.findMany({
      where: {
        intrabbler_id: intrabblerUserId,
        is_active: true
      },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' }
      ]
    });

    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    const summary = daysOfWeek.map((dayName, index) => {
      const daySlots = availability.filter(slot => slot.day_of_week === index);
      return {
        day_of_week: index,
        day_name: dayName,
        slots: daySlots.map(slot => ({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time
        })),
        has_availability: daySlots.length > 0
      };
    });

    const totalSlots = availability.length;
    const activeDays = summary.filter(day => day.has_availability).length;

    return {
      summary,
      statistics: {
        total_slots: totalSlots,
        active_days: activeDays,
        has_any_availability: totalSlots > 0
      }
    };
  }

  async hasAvailability(intrabblerUserId: string): Promise<boolean> {
    const count = await this.prisma.allyAvailability.count({
      where: {
        intrabbler_id: intrabblerUserId,
        is_active: true
      }
    });

    return count > 0;
  }
}