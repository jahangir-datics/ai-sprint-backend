import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWebhookDto } from './dto/create-webhook.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto.js';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWebhookDto) {
    const secret = 'whsec_' + randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        userId,
        name: dto.name,
        url: dto.url,
        secret,
        description: dto.description,
        subscribedEvents: dto.subscribedEvents,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret,
      description: webhook.description,
      subscribedEvents: webhook.subscribedEvents,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  async findAll(userId: string, query: ListWebhooksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.eventType) where.subscribedEvents = { has: query.eventType };

    const [items, total] = await Promise.all([
      this.prisma.webhook.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          url: true,
          description: true,
          subscribedEvents: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhook.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        subscribedEvents: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(userId: string, id: string, dto: UpdateWebhookDto) {
    await this.ensureOwnership(userId, id);

    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        subscribedEvents: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return webhook;
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnership(userId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { deleted: true };
  }

  async activate(userId: string, id: string) {
    await this.ensureOwnership(userId, id);
    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: { isActive: true },
    });
    return { id: webhook.id, isActive: webhook.isActive };
  }

  async deactivate(userId: string, id: string) {
    await this.ensureOwnership(userId, id);
    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: { isActive: false },
    });
    return { id: webhook.id, isActive: webhook.isActive };
  }

  private async ensureOwnership(userId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, userId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }
}
