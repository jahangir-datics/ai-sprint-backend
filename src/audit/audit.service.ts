import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';

export interface CreateAuditLogInput {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  method?: string | null;
  path?: string | null;
  details?: Record<string, unknown> | null;
  requestBody?: Record<string, unknown> | null;
  responseBody?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  statusCode: number;
  success: boolean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          method: input.method ?? null,
          path: input.path ?? null,
          details: (input.details as Prisma.InputJsonValue) ?? undefined,
          requestBody:
            (input.requestBody as Prisma.InputJsonValue) ?? undefined,
          responseBody:
            (input.responseBody as Prisma.InputJsonValue) ?? undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          statusCode: input.statusCode,
          success: input.success,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
    }
  }

  async findAll(query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.resource) where.resource = query.resource;
    if (query.action) where.action = query.action;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.statusCode !== undefined) where.statusCode = query.statusCode;
    if (query.success !== undefined) where.success = query.success;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          action: true,
          resource: true,
          resourceId: true,
          method: true,
          path: true,
          statusCode: true,
          success: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }
}
