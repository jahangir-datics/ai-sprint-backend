import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: {
    activity: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  describe('create', () => {
    it('should create an activity entry', async () => {
      prisma.activity.create.mockResolvedValue({ id: 'act-1' });

      const result = await service.create({
        userId: 'user-1',
        type: 'WEBHOOK_CREATED',
        message: 'You created a webhook',
        resource: 'webhook',
        resourceId: 'wh-1',
      });
      expect(result.id).toBe('act-1');
    });
  });

  describe('findAll', () => {
    it('should return user-scoped paginated activities', async () => {
      prisma.activity.findMany.mockResolvedValue([{ id: 'act-1' }]);
      prisma.activity.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);

      const call = prisma.activity.findMany.mock.calls[0][0] as {
        where: { userId: string };
      };
      expect(call.where.userId).toBe('user-1');
    });

    it('should filter by type', async () => {
      prisma.activity.findMany.mockResolvedValue([]);
      prisma.activity.count.mockResolvedValue(0);

      await service.findAll('user-1', {
        page: 1,
        limit: 20,
        type: 'WEBHOOK_CREATED',
      });

      const call = prisma.activity.findMany.mock.calls[0][0] as {
        where: { type: string };
      };
      expect(call.where.type).toBe('WEBHOOK_CREATED');
    });
  });

  describe('findOne', () => {
    it('should return activity owned by user', async () => {
      prisma.activity.findFirst.mockResolvedValue({ id: 'act-1' });
      const result = await service.findOne('user-1', 'act-1');
      expect(result.id).toBe('act-1');
    });

    it('should throw NotFoundException if not owned', async () => {
      prisma.activity.findFirst.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'act-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
