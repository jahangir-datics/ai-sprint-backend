import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryActivityDto } from './dto/query-activity.dto.js';

export interface CreateActivityInput {
  userId: string;
  type: string;
  message: string;
  resource?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateActivityInput) {
    return this.prisma.activity.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        resource: input.resource ?? null,
        resourceId: input.resourceId ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async findAll(userId: string, query: QueryActivityDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = { userId };
    if (query.type) where.type = query.type;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          message: true,
          resource: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(userId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, userId },
      select: {
        id: true,
        type: true,
        message: true,
        resource: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }
}
