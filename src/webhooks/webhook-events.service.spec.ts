import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhookEventsService', () => {
  let service: WebhookEventsService;
  let prisma: {
    webhook: { findMany: jest.Mock; findFirst: jest.Mock };
    webhookEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    webhookDelivery: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      webhook: { findMany: jest.fn(), findFirst: jest.fn() },
      webhookEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      webhookDelivery: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WebhookEventsService>(WebhookEventsService);
  });

  describe('emit', () => {
    it('should create events for matching active webhooks', async () => {
      prisma.webhook.findMany.mockResolvedValue([
        { id: 'wh-1', isActive: true, subscribedEvents: ['user.created'] },
        { id: 'wh-2', isActive: true, subscribedEvents: ['user.created'] },
      ]);
      prisma.webhookEvent.create.mockResolvedValue({ id: 'evt-1' });

      const result = await service.emit('user.created', { userId: '123' });

      expect(result).toHaveLength(2);
      expect(prisma.webhookEvent.create).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no webhooks match', async () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      const result = await service.emit('user.created', { userId: '123' });

      expect(result).toHaveLength(0);
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('findByWebhook', () => {
    it('should return paginated events for owned webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhookEvent.findMany.mockResolvedValue([{ id: 'evt-1' }]);
      prisma.webhookEvent.count.mockResolvedValue(1);

      const result = await service.findByWebhook('user-1', 'wh-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw NotFoundException if webhook not owned', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(
        service.findByWebhook('user-2', 'wh-1', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('retry', () => {
    it('should reset failed event to PENDING', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhookEvent.findFirst.mockResolvedValue({
        id: 'evt-1',
        webhookId: 'wh-1',
        status: 'FAILED',
      });
      prisma.webhookEvent.update.mockResolvedValue({});

      const result = await service.retry('user-1', 'wh-1', 'evt-1');

      expect(result.status).toBe('PENDING');
      expect(result.queued).toBe(true);
    });

    it('should reject retry of non-failed event', async () => {
      prisma.webhook.findFirst.mockResolvedValue({
        id: 'wh-1',
        userId: 'user-1',
      });
      prisma.webhookEvent.findFirst.mockResolvedValue({
        id: 'evt-1',
        webhookId: 'wh-1',
        status: 'DELIVERED',
      });

      await expect(service.retry('user-1', 'wh-1', 'evt-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createTestEvent', () => {
    it('should create a test event with PENDING status', async () => {
      prisma.webhookEvent.create.mockResolvedValue({ id: 'evt-test' });

      const result = await service.createTestEvent('wh-1', 'webhook.created');

      expect(result.eventId).toBe('evt-test');
      expect(result.status).toBe('PENDING');
      expect(result.queued).toBe(true);
    });
  });
});
