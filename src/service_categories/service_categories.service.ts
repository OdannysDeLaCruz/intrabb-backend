import { Injectable } from '@nestjs/common';
import { UpdateServiceCategoryDto } from './dto/update-service_category.dto';
import { SearchServiceCategoryDto } from './dto/search-service-category.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  create() {
    // return this.prisma.serviceCategory.create({ data: createServiceCategoryDto });
  }

  findAll() {
    return this.prisma.serviceCategory.findMany({
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon_url: true,
            description: true,
          },
          where: {
            is_active: true,
          },
        },
        _count: {
          select: {
            service_requests: true,
          },
        },
      },
      orderBy: [
        {
          service_requests: {
            _count: 'desc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  findOne(id: number) {
    return this.prisma.serviceCategory.findUnique({ 
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon_url: true,
            description: true,
          },
          where: {
            is_active: true,
          },
        },
        _count: {
          select: {
            service_requests: true,
          },
        },
      },
    });
  }

  async findOneWithDetails(id: number) {
    return this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon_url: true,
            description: true,
          },
          where: {
            is_active: true,
          },
        },
        category_parameters: {
          select: {
            id: true,
            name: true,
            code: true,
            parameter_type: true,
            is_required: true,
            is_active: true,
            options_json: true,
            min_value: true,
            max_value: true,
          },
          where: {
            is_active: true,
          },
        },
        _count: {
          select: {
            service_requests: true,
          },
        },
      },
    });
  }

  async findOneWithParameters(id: number) {
    return this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon_url: true,
            description: true,
          },
          where: {
            is_active: true,
          },
        },
        category_parameters: {
          select: {
            id: true,
            name: true,
            code: true,
            parameter_type: true,
            is_required: true,
            is_active: true,
            options_json: true,
            min_value: true,
            max_value: true,
            service_category_id: true,
          },
          where: {
            is_active: true,
          },
        },
      },
    });
  }

  update(id: number, updateServiceCategoryDto: UpdateServiceCategoryDto) {
    return this.prisma.serviceCategory.update({ where: { id }, data: updateServiceCategoryDto });
  }

  remove(id: number) {
    return this.prisma.serviceCategory.delete({ where: { id } });
  }

  async search(searchDto: SearchServiceCategoryDto) {
    const { query, categoryId, limit = 20, offset = 0 } = searchDto;

    // Generate cache key
    const cacheKey = this.cacheService.generateSearchKey(query, categoryId, limit, offset);
    
    // Try to get from cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Build the where clause
    const where: any = {
      is_active: true,
    };

    // Add parent category filter if provided
    if (categoryId) {
      // Check if categoryId is a number (ID) or string (slug)
      const isNumeric = /^\d+$/.test(categoryId);
      
      if (isNumeric) {
        // It's an ID, use directly
        where.parent_id = parseInt(categoryId);
      } else {
        // It's a slug, convert to ID first
        const parentCategory = await this.prisma.serviceCategory.findUnique({
          where: { slug: categoryId },
          select: { id: true }
        });
        
        if (parentCategory) {
          where.parent_id = parentCategory.id;
        } else {
          // If slug not found, return empty results
          where.parent_id = -1;
        }
      }
    }

    // If there's a search query, add search conditions
    if (query && query.trim()) {
      const searchTerm = query.trim();
      
      // Use PostgreSQL's full-text search capabilities
      where.OR = [
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Execute the search with pagination
    const [categories, total] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon_url: true,
            },
            where: {
              is_active: true,
            },
          },
          _count: {
            select: {
              service_requests: true,
            },
          },
        },
        orderBy: [
          // Then by popularity (service requests count)
          {
            service_requests: {
              _count: 'desc',
            },
          },
          // Finally by name alphabetically
          {
            name: 'asc',
          },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    const result = {
      data: categories,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };

    // Cache the result for 5 minutes
    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  async getPopularCategories(limit: number = 10) {
    // Generate cache key
    const cacheKey = this.cacheService.generatePopularKey(limit);
    
    // Try to get from cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const result = await this.prisma.serviceCategory.findMany({
      where: {
        is_active: true,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            service_requests: true,
          },
        },
      },
      orderBy: {
        service_requests: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    // Cache the result for 10 minutes
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  async getSuggestions(query: string, limit: number = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Generate cache key
    const cacheKey = this.cacheService.generateSuggestionsKey(query, limit);
    
    // Try to get from cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const searchTerm = query.trim();
    
    const result = await this.prisma.serviceCategory.findMany({
      where: {
        is_active: true,
        OR: [
          {
            name: {
              startsWith: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        icon_url: true,
      },
      orderBy: [
        {
          name: 'asc',
        },
      ],
      take: limit,
    });

    // Cache the result for 2 minutes (shorter TTL for suggestions)
    await this.cacheService.set(cacheKey, result, 120);

    return result;
  }

  async findParentCategories() {
    // Generate cache key
    const cacheKey = 'service_categories:parents';
    
    // Try to get from cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      // return cachedResult;
    }

    const result = await this.prisma.serviceCategory.findMany({
      where: {
        is_active: true,
        parent_id: null, // Only categories without parent (parent categories)
      },
      include: {
        _count: {
          select: {
            service_requests: true,
            children: true,
          },
        },
      },
      orderBy: [
        {
          service_requests: {
            _count: 'desc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });

    // Cache the result for 10 minutes
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  async findFixedPriceCategories() {
    // Generate cache key
    const cacheKey = 'service_categories:fixed_price';
    
    // Try to get from cache first
    const cachedResult = await this.cacheService.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const result = await this.prisma.serviceCategory.findMany({
      where: {
        is_active: true,
        has_fixed_price: true,
        fixed_price_amount: {
          not: null
        }
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            service_requests: true,
          },
        },
      },
      orderBy: [
        {
          service_requests: {
            _count: 'desc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });

    // Cache the result for 10 minutes
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  // Cache invalidation methods
  async invalidateCache() {
    await this.cacheService.invalidateAllSearchCaches();
  }
}
