import { Test, TestingModule } from '@nestjs/testing';
import { ServiceRequestController } from './service_request.controller';

describe('ServiceRequestController', () => {
  let controller: ServiceRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRequestController],
    }).compile();

    controller = module.get<ServiceRequestController>(ServiceRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
