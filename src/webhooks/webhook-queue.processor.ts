import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';

const RETRY_DELAYS_MS = [10_000, 30_000, 120_000, 600_000, 1_800_000];
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5_000;

@Injectable()
export class WebhookQueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueProcessor.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  onModuleInit() {
    this.intervalId = setInterval(() => {
      void this.processNext();
    }, POLL_INTERVAL_MS);
    this.logger.log('Webhook queue processor started');
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Webhook queue processor stopped');
  }

  async processNext(): Promise<boolean> {
    if (this.stopped) return false;

    const event = await this.prisma.webhookEvent.findFirst({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      include: { webhook: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!event) return false;

    // Optimistic lock: only proceed if we can transition the status
    const updated = await this.prisma.webhookEvent.updateMany({
      where: {
        id: event.id,
        status: { in: ['PENDING', 'RETRYING'] },
      },
      data: { status: 'PROCESSING' },
    });

    if (updated.count === 0) return false;

    // Check if webhook is still active
    if (!event.webhook.isActive) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', lastError: 'Webhook inactive' },
      });
      return true;
    }

    // Count existing delivery attempts
    const existingAttempts = await this.prisma.webhookDelivery.count({
      where: { webhookEventId: event.id },
    });
    const attemptNumber = existingAttempts + 1;

    const result = await this.deliveryService.deliver(
      event.id,
      attemptNumber,
      event.webhook.url,
      event.webhook.secret,
      event.webhook.id,
      event.eventType,
      event.payload,
    );

    if (result.success) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          lastError: null,
        },
      });
    } else if (
      this.deliveryService.shouldRetry(result) &&
      attemptNumber < MAX_ATTEMPTS
    ) {
      const delayMs =
        RETRY_DELAYS_MS[attemptNumber - 1] ??
        RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      const nextAttemptAt = new Date(Date.now() + delayMs);

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'RETRYING',
          nextAttemptAt,
          lastError: result.errorMessage,
        },
      });
    } else {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          lastError: result.errorMessage,
        },
      });
    }

    return true;
  }
}
