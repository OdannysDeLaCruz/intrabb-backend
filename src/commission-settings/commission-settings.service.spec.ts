import { Test, TestingModule } from '@nestjs/testing';
import { CommissionSettingsService } from './commission-settings.service';

describe('CommissionSettingsService', () => {
  let service: CommissionSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommissionSettingsService],
    }).compile();

    service = module.get<CommissionSettingsService>(CommissionSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
