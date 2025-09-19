import { Test, TestingModule } from '@nestjs/testing';
import { AllyAvailabilityController } from './ally-availability.controller';

describe('AllyAvailabilityController', () => {
  let controller: AllyAvailabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AllyAvailabilityController],
    }).compile();

    controller = module.get<AllyAvailabilityController>(AllyAvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
