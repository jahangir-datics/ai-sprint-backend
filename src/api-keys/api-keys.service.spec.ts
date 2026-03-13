import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: {
    apiKey: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  describe('create', () => {
    it('should create an API key with ask_ prefix', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        keyPrefix: 'ask_ab12',
        keyHash: 'hash',
      });

      const result = await service.create('user-1', {
        name: 'Test Key',
        scopes: ['read'],
      });

      expect(result.key).toMatch(/^ask_[a-f0-9]{32}$/);
      expect(result.keyPrefix).toBeDefined();
      expect(result.name).toBe('Test Key');
      expect(result.id).toBeDefined();
    });

    it('should store the SHA-256 hash, not the raw key', async () => {
      prisma.apiKey.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'key-1',
          name: data.name,
          keyPrefix: data.keyPrefix,
          keyHash: data.keyHash,
        });
      });

      const result = await service.create('user-1', { name: 'Test Key' });

      const createCall = prisma.apiKey.create.mock.calls[0][0];
      const expectedHash = createHash('sha256')
        .update(result.key)
        .digest('hex');
      expect(createCall.data.keyHash).toBe(expectedHash);
    });

    it('should set expiresAt when provided', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        keyPrefix: 'ask_ab12',
      });

      await service.create('user-1', {
        name: 'Test Key',
        expiresAt: '2026-12-31T23:59:59Z',
      });

      const createCall = prisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.expiresAt).toEqual(
        new Date('2026-12-31T23:59:59Z'),
      );
    });
  });

  describe('findAllByUser', () => {
    it('should return non-revoked keys for the user', async () => {
      const keys = [
        { id: 'key-1', name: 'Key 1', keyPrefix: 'ask_1234' },
        { id: 'key-2', name: 'Key 2', keyPrefix: 'ask_5678' },
      ];
      prisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await service.findAllByUser('user-1');

      expect(result).toEqual(keys);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isRevoked: false },
        }),
      );
    });
  });

  describe('revoke', () => {
    it('should revoke an existing key owned by the user', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
      });
      prisma.apiKey.update.mockResolvedValue({ id: 'key-1', isRevoked: true });

      await service.revoke('key-1', 'user-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw NotFoundException if key does not exist', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if key belongs to another user', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('key-1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateApiKey', () => {
    it('should return user for a valid API key', async () => {
      const rawKey = 'ask_abcdef1234567890abcdef12345678';
      const keyHash = createHash('sha256').update(rawKey).digest('hex');

      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        keyHash,
        isRevoked: false,
        expiresAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'USER',
          isActive: true,
        },
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey(rawKey);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        role: 'USER',
      });
    });

    it('should throw UnauthorizedException for invalid key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.validateApiKey('ask_invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for revoked key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isRevoked: true,
        user: { id: 'user-1', isActive: true },
      });

      await expect(
        service.validateApiKey('ask_abcdef1234567890abcdef12345678'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired key', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isRevoked: false,
        expiresAt: pastDate,
        user: { id: 'user-1', isActive: true },
      });

      await expect(
        service.validateApiKey('ask_abcdef1234567890abcdef12345678'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isRevoked: false,
        expiresAt: null,
        user: { id: 'user-1', isActive: false },
      });

      await expect(
        service.validateApiKey('ask_abcdef1234567890abcdef12345678'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastUsedAt on successful validation', async () => {
      const rawKey = 'ask_abcdef1234567890abcdef12345678';
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isRevoked: false,
        expiresAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'USER',
          isActive: true,
        },
      });
      prisma.apiKey.update.mockResolvedValue({});

      await service.validateApiKey(rawKey);

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});
