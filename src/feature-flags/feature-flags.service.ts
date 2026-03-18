import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto.js';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto.js';
import { ListFeatureFlagsQueryDto } from './dto/list-feature-flags-query.dto.js';

export interface EvaluationResult {
  enabled: boolean;
  reason:
    | 'FLAG_DISABLED'
    | 'USER_TARGETED'
    | 'ROLE_MATCH'
    | 'ROLLOUT_MATCH'
    | 'NOT_IN_ROLLOUT'
    | 'FLAG_NOT_FOUND';
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeatureFlagDto, userId?: string) {
    try {
      const flag = await this.prisma.featureFlag.create({
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description,
          isEnabled: dto.isEnabled ?? false,
          rolloutPercent: dto.rolloutPercent ?? 0,
          targetUsers: dto.targetUsers ?? [],
          targetRoles: (dto.targetRoles as Role[]) ?? [],
          environment: dto.environment ?? 'production',
          createdBy: userId,
        },
      });
      return flag;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Feature flag key '${dto.key}' already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(query: ListFeatureFlagsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.environment) where.environment = query.environment;

    const [items, total] = await Promise.all([
      this.prisma.featureFlag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.featureFlag.count({ where }),
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

  async findOne(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }

  async update(id: string, dto: UpdateFeatureFlagDto, userId?: string) {
    await this.findOne(id);

    const flag = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        ...dto,
        targetRoles: dto.targetRoles ? (dto.targetRoles as Role[]) : undefined,
        updatedBy: userId,
      },
    });
    return flag;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.featureFlag.delete({ where: { id } });
    return { deleted: true };
  }

  async evaluate(
    flagKey: string,
    userId: string,
    userRoles: string[] = [],
  ): Promise<EvaluationResult> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });

    if (!flag) {
      return { enabled: false, reason: 'FLAG_NOT_FOUND' };
    }

    if (!flag.isEnabled) {
      return { enabled: false, reason: 'FLAG_DISABLED' };
    }

    if (flag.targetUsers.includes(userId)) {
      return { enabled: true, reason: 'USER_TARGETED' };
    }

    if (userRoles.some((role) => flag.targetRoles.includes(role as Role))) {
      return { enabled: true, reason: 'ROLE_MATCH' };
    }

    const bucket = deterministicHash(flag.key + userId);
    if (bucket < flag.rolloutPercent) {
      return { enabled: true, reason: 'ROLLOUT_MATCH' };
    }

    return { enabled: false, reason: 'NOT_IN_ROLLOUT' };
  }
}

export function deterministicHash(input: string): number {
  const hash = createHash('sha256').update(input).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}
