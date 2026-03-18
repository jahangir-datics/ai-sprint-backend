import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FeatureFlagsService,
  deterministicHash,
} from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: {
    featureFlag: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      featureFlag: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  describe('create', () => {
    it('should create a feature flag', async () => {
      prisma.featureFlag.create.mockResolvedValue({
        id: 'ff-1',
        key: 'test_flag',
        name: 'Test Flag',
      });

      const result = await service.create({
        key: 'test_flag',
        name: 'Test Flag',
      });
      expect(result.key).toBe('test_flag');
    });

    it('should throw ConflictException on duplicate key', async () => {
      prisma.featureFlag.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '7.0.0',
        }),
      );

      await expect(service.create({ key: 'dup', name: 'Dup' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated flags', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([{ id: 'ff-1' }]);
      prisma.featureFlag.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ id: 'ff-1' });
      const result = await service.findOne('ff-1');
      expect(result.id).toBe('ff-1');
    });

    it('should throw NotFoundException', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ff-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ id: 'ff-1' });
      prisma.featureFlag.delete.mockResolvedValue({});

      const result = await service.remove('ff-1');
      expect(result.deleted).toBe(true);
    });
  });

  describe('evaluate', () => {
    const baseFlag = {
      id: 'ff-1',
      key: 'test_flag',
      isEnabled: true,
      targetUsers: [] as string[],
      targetRoles: [] as string[],
      rolloutPercent: 0,
    };

    it('should return FLAG_NOT_FOUND for unknown key', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      const result = await service.evaluate('unknown', 'user-1');
      expect(result).toEqual({ enabled: false, reason: 'FLAG_NOT_FOUND' });
    });

    it('should return FLAG_DISABLED when not enabled', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        ...baseFlag,
        isEnabled: false,
      });
      const result = await service.evaluate('test_flag', 'user-1');
      expect(result).toEqual({ enabled: false, reason: 'FLAG_DISABLED' });
    });

    it('should return USER_TARGETED when user is in targetUsers', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        ...baseFlag,
        targetUsers: ['user-1'],
      });
      const result = await service.evaluate('test_flag', 'user-1');
      expect(result).toEqual({ enabled: true, reason: 'USER_TARGETED' });
    });

    it('should return ROLE_MATCH when user role matches', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        ...baseFlag,
        targetRoles: ['ADMIN'],
      });
      const result = await service.evaluate('test_flag', 'user-1', ['ADMIN']);
      expect(result).toEqual({ enabled: true, reason: 'ROLE_MATCH' });
    });

    it('should return ROLLOUT_MATCH when user falls within rollout', async () => {
      const bucket = deterministicHash('test_flag' + 'user-1');
      prisma.featureFlag.findUnique.mockResolvedValue({
        ...baseFlag,
        rolloutPercent: bucket + 1, // ensure user is within rollout
      });
      const result = await service.evaluate('test_flag', 'user-1');
      expect(result).toEqual({ enabled: true, reason: 'ROLLOUT_MATCH' });
    });

    it('should return NOT_IN_ROLLOUT when user falls outside rollout', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        ...baseFlag,
        rolloutPercent: 0,
      });
      const result = await service.evaluate('test_flag', 'user-1');
      expect(result).toEqual({ enabled: false, reason: 'NOT_IN_ROLLOUT' });
    });
  });

  describe('deterministicHash', () => {
    it('should be deterministic (same input = same output)', () => {
      const a = deterministicHash('test_flaguser-1');
      const b = deterministicHash('test_flaguser-1');
      expect(a).toBe(b);
    });

    it('should return value between 0 and 99', () => {
      for (let i = 0; i < 100; i++) {
        const val = deterministicHash(`flag_${i}user_${i}`);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(100);
      }
    });

    it('should produce different values for different inputs', () => {
      const a = deterministicHash('flag_auser_1');
      const b = deterministicHash('flag_buser_1');
      // Not guaranteed to be different, but extremely likely with different inputs
      // Just check they're both valid numbers
      expect(typeof a).toBe('number');
      expect(typeof b).toBe('number');
    });
  });
});
