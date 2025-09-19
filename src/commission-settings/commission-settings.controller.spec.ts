import { Test, TestingModule } from '@nestjs/testing';
import { CommissionSettingsController } from './commission-settings.controller';

describe('CommissionSettingsController', () => {
  let controller: CommissionSettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommissionSettingsController],
    }).compile();

    controller = module.get<CommissionSettingsController>(CommissionSettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
