import { Test, TestingModule } from '@nestjs/testing';
import { AllyAvailabilityService } from './ally-availability.service';

describe('AllyAvailabilityService', () => {
  let service: AllyAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllyAvailabilityService],
    }).compile();

    service = module.get<AllyAvailabilityService>(AllyAvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
