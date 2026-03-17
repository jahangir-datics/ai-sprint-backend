import { Test, TestingModule } from '@nestjs/testing';
import { WebhookQueueProcessor } from './webhook-queue.processor';
import {
  WebhookDeliveryService,
  DeliveryResult,
} from './webhook-delivery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhookQueueProcessor', () => {
  let processor: WebhookQueueProcessor;
  let prisma: {
    webhookEvent: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    webhookDelivery: { count: jest.Mock };
  };
  let deliveryService: {
    deliver: jest.Mock;
    shouldRetry: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      webhookEvent: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      webhookDelivery: { count: jest.fn() },
    };

    deliveryService = {
      deliver: jest.fn(),
      shouldRetry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookQueueProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: WebhookDeliveryService, useValue: deliveryService },
      ],
    }).compile();

    processor = module.get<WebhookQueueProcessor>(WebhookQueueProcessor);
    // Clear the interval without setting stopped flag
    clearInterval(processor['intervalId']);
    processor['intervalId'] = null;
  });

  const mockEvent = {
    id: 'evt-1',
    webhookId: 'wh-1',
    eventType: 'user.created',
    payload: { userId: '123' },
    status: 'PENDING',
    webhook: {
      id: 'wh-1',
      url: 'https://example.com/hook',
      secret: 'whsec_test',
      isActive: true,
    },
  };

  const successResult: DeliveryResult = {
    success: true,
    status: 'SUCCESS',
    responseCode: 200,
    responseBody: 'OK',
    errorMessage: null,
    durationMs: 150,
  };

  const failResult: DeliveryResult = {
    success: false,
    status: 'FAILED',
    responseCode: 500,
    responseBody: 'Internal Server Error',
    errorMessage: 'HTTP 500 Internal Server Error',
    durationMs: 200,
  };

  it('should return false when no pending events', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue(null);

    const result = await processor.processNext();
    expect(result).toBe(false);
  });

  it('should mark event DELIVERED on success', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue(mockEvent);
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.webhookDelivery.count.mockResolvedValue(0);
    deliveryService.deliver.mockResolvedValue(successResult);

    const result = await processor.processNext();

    expect(result).toBe(true);
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ status: 'DELIVERED' }),
    });
  });

  it('should mark event RETRYING on retryable failure with attempts left', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue(mockEvent);
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.webhookDelivery.count.mockResolvedValue(0); // first attempt
    deliveryService.deliver.mockResolvedValue(failResult);
    deliveryService.shouldRetry.mockReturnValue(true);

    await processor.processNext();

    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ status: 'RETRYING' }),
    });
  });

  it('should mark event FAILED after max attempts', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue(mockEvent);
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.webhookDelivery.count.mockResolvedValue(4); // 5th attempt
    deliveryService.deliver.mockResolvedValue(failResult);
    deliveryService.shouldRetry.mockReturnValue(true);

    await processor.processNext();

    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('should mark event FAILED when webhook is inactive', async () => {
    const inactiveEvent = {
      ...mockEvent,
      webhook: { ...mockEvent.webhook, isActive: false },
    };
    prisma.webhookEvent.findFirst.mockResolvedValue(inactiveEvent);
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await processor.processNext();

    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { status: 'FAILED', lastError: 'Webhook inactive' },
    });
    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });

  it('should skip if optimistic lock fails', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue(mockEvent);
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 0 });

    const result = await processor.processNext();

    expect(result).toBe(false);
    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });
});
