import { Injectable } from '@nestjs/common';
import { CreateServiceCategoryDto } from './dto/create-service_category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service_category.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createServiceCategoryDto: CreateServiceCategoryDto) {
    // return this.prisma.serviceCategory.create({ data: createServiceCategoryDto });
  }

  findAll() {
    return this.prisma.serviceCategory.findMany();
  }

  findOne(id: number) {
    return this.prisma.serviceCategory.findUnique({ where: { id } });
  }

  update(id: number, updateServiceCategoryDto: UpdateServiceCategoryDto) {
    return this.prisma.serviceCategory.update({ where: { id }, data: updateServiceCategoryDto });
  }

  remove(id: number) {
    return this.prisma.serviceCategory.delete({ where: { id } });
  }
}
