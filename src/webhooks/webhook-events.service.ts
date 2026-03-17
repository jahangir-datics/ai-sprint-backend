import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';

@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(eventType: string, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        subscribedEvents: { has: eventType },
      },
    });

    if (webhooks.length === 0) return [];

    const events = await Promise.all(
      webhooks.map((webhook) =>
        this.prisma.webhookEvent.create({
          data: {
            webhookId: webhook.id,
            eventType,
            payload: payload as Prisma.InputJsonValue,
            status: 'PENDING',
          },
        }),
      ),
    );

    return events;
  }

  async findByWebhook(
    userId: string,
    webhookId: string,
    query: ListEventsQueryDto,
  ) {
    await this.ensureWebhookOwnership(userId, webhookId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { webhookId };
    if (query.status) where.status = query.status as WebhookEventStatus;
    if (query.eventType) where.eventType = query.eventType;

    const [items, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          status: true,
          deliveredAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(userId: string, webhookId: string, eventId: string) {
    await this.ensureWebhookOwnership(userId, webhookId);

    const event = await this.prisma.webhookEvent.findFirst({
      where: { id: eventId, webhookId },
      select: {
        id: true,
        eventType: true,
        payload: true,
        status: true,
        nextAttemptAt: true,
        deliveredAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!event) throw new NotFoundException('Webhook event not found');
    return event;
  }

  async getDeliveries(userId: string, webhookId: string, eventId: string) {
    await this.ensureWebhookOwnership(userId, webhookId);

    const event = await this.prisma.webhookEvent.findFirst({
      where: { id: eventId, webhookId },
    });
    if (!event) throw new NotFoundException('Webhook event not found');

    const items = await this.prisma.webhookDelivery.findMany({
      where: { webhookEventId: eventId },
      orderBy: { attemptNumber: 'asc' },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        responseCode: true,
        errorMessage: true,
        durationMs: true,
        attemptedAt: true,
      },
    });

    return { items };
  }

  async retry(userId: string, webhookId: string, eventId: string) {
    await this.ensureWebhookOwnership(userId, webhookId);

    const event = await this.prisma.webhookEvent.findFirst({
      where: { id: eventId, webhookId },
    });
    if (!event) throw new NotFoundException('Webhook event not found');

    if (event.status !== 'FAILED') {
      throw new BadRequestException('Only failed events can be retried');
    }

    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING', nextAttemptAt: null, lastError: null },
    });

    return { eventId, status: 'PENDING', queued: true };
  }

  async createTestEvent(webhookId: string, eventType: string) {
    const event = await this.prisma.webhookEvent.create({
      data: {
        webhookId,
        eventType,
        payload: {
          id: `test_${Date.now()}`,
          type: eventType,
          timestamp: new Date().toISOString(),
          data: { test: true, message: 'This is a test webhook delivery' },
        },
        status: 'PENDING',
      },
    });

    return { eventId: event.id, status: 'PENDING', queued: true };
  }

  private async ensureWebhookOwnership(userId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }
}
