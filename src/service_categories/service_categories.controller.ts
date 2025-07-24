import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ServiceCategoriesService } from './service_categories.service';
import { CreateServiceCategoryDto } from './dto/create-service_category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service_category.dto';
import { SearchServiceCategoryDto } from './dto/search-service-category.dto';

@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(private readonly serviceCategoriesService: ServiceCategoriesService) {}

  @Post()
  create(@Body() createServiceCategoryDto: CreateServiceCategoryDto) {
    return this.serviceCategoriesService.create(createServiceCategoryDto);
  }

  @Get()
  findAll() {
    return this.serviceCategoriesService.findAll();
  }

  @Get('search')
  search(@Query() searchDto: SearchServiceCategoryDto) {
    return this.serviceCategoriesService.search(searchDto);
  }

  @Get('popular')
  getPopular(@Query('limit') limit?: number) {
    return this.serviceCategoriesService.getPopularCategories(limit);
  }

  @Get('suggestions')
  getSuggestions(@Query('query') query: string, @Query('limit') limit?: number) {
    return this.serviceCategoriesService.getSuggestions(query, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceCategoriesService.findOne(+id);
  }

  @Get(':id/details')
  findOneWithDetails(@Param('id') id: string) {
    return this.serviceCategoriesService.findOneWithDetails(+id);
  }

  @Get(':id/with-parameters')
  findOneWithParameters(@Param('id') id: string) {
    return this.serviceCategoriesService.findOneWithParameters(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServiceCategoryDto: UpdateServiceCategoryDto) {
    return this.serviceCategoriesService.update(+id, updateServiceCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceCategoriesService.remove(+id);
  }
}
