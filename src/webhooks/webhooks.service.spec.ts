import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: {
    webhook: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      webhook: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  describe('create', () => {
    it('should create a webhook with generated secret', async () => {
      prisma.webhook.create.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
        name: 'Test Webhook',
        url: 'https://example.com/hook',
        secret: 'whsec_abc123',
        description: null,
        subscribedEvents: ['user.created'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create('user-1', {
        name: 'Test Webhook',
        url: 'https://example.com/hook',
        subscribedEvents: ['user.created'],
      });

      expect(result.id).toBe('wh-1');
      expect(result.secret).toMatch(/^whsec_[a-f0-9]{64}$/);
      expect(prisma.webhook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Test Webhook',
          url: 'https://example.com/hook',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      prisma.webhook.findMany.mockResolvedValue([
        {
          id: 'wh-1',
          name: 'Test',
          url: 'https://example.com',
          subscribedEvents: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      prisma.webhook.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by isActive', async () => {
      prisma.webhook.findMany.mockResolvedValue([]);
      prisma.webhook.count.mockResolvedValue(0);

      await service.findAll('user-1', { page: 1, limit: 20, isActive: true });

      const call = prisma.webhook.findMany.mock.calls[0][0] as {
        where: { isActive: boolean };
      };
      expect(call.where.isActive).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return webhook for owner', async () => {
      prisma.webhook.findFirst.mockResolvedValue({ id: 'wh-1', name: 'Test' });

      const result = await service.findOne('user-1', 'wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundException for non-existent webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'wh-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update webhook after ownership check', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhook.update.mockResolvedValue({
        id: 'wh-1',
        name: 'Updated',
        url: 'https://example.com',
        subscribedEvents: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update('user-1', 'wh-1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if not owner', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-2', 'wh-1', { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete webhook after ownership check', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhook.delete.mockResolvedValue({});

      const result = await service.remove('user-1', 'wh-1');
      expect(result.deleted).toBe(true);
    });
  });

  describe('activate / deactivate', () => {
    it('should activate a webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhook.update.mockResolvedValue({ id: 'wh-1', isActive: true });

      const result = await service.activate('user-1', 'wh-1');
      expect(result.isActive).toBe(true);
    });

    it('should deactivate a webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhook.update.mockResolvedValue({ id: 'wh-1', isActive: false });

      const result = await service.deactivate('user-1', 'wh-1');
      expect(result.isActive).toBe(false);
    });
  });
});
