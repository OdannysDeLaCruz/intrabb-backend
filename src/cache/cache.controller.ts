import { Controller, Get } from '@nestjs/common';
import { CacheService } from './cache.service';
import { Public } from 'src/common/decorators';

@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('clear')
  @Public()
  async clearAllCache() {
    await this.cacheService.flush();
    return {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    };
  }
}