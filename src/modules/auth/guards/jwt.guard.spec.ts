import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt.guard';

describe('JwtAuthGuard', () => {
  let configSvc: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService],
    }).compile();

    configSvc = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(new JwtAuthGuard(configSvc)).toBeDefined();
  });
});
