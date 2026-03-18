import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('create', () => {
    it('should create an audit log', async () => {
      await service.create({
        action: 'CREATE',
        resource: 'webhook',
        statusCode: 201,
        success: true,
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should not throw on persistence failure', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('DB error'));
      await expect(
        service.create({
          action: 'CREATE',
          resource: 'test',
          statusCode: 201,
          success: true,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by resource and action', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        resource: 'webhook',
        action: 'CREATE',
      });

      const call = prisma.auditLog.findMany.mock.calls[0][0] as {
        where: { resource: string; action: string };
      };
      expect(call.where.resource).toBe('webhook');
      expect(call.where.action).toBe('CREATE');
    });
  });

  describe('findOne', () => {
    it('should return an audit log', async () => {
      prisma.auditLog.findUnique.mockResolvedValue({ id: 'log-1' });
      const result = await service.findOne('log-1');
      expect(result.id).toBe('log-1');
    });

    it('should throw NotFoundException', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(null);
      await expect(service.findOne('log-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
