import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('7d'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
        password: 'hashed',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      });

      expect(result).toEqual({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test',
        }),
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash the password with bcrypt', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        name: null,
        password: 'hashed',
      });

      await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      const isHashed = await bcrypt.compare(
        'password123',
        createCall.data.password,
      );
      expect(isHashed).toBe(true);
    });
  });

  describe('validateUser', () => {
    it('should return user data for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
        password: hashedPassword,
        isActive: true,
      });

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('no@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        password: 'hashed',
        isActive: false,
      });

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        password: hashedPassword,
        isActive: true,
      });

      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token, refresh token, and expiresIn', async () => {
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login({
        id: 'uuid-1',
        email: 'test@example.com',
        role: 'USER',
      });

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'uuid-1',
        email: 'test@example.com',
        role: 'USER',
      });
    });
  });

  describe('refresh', () => {
    it('should return new access token for valid refresh token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'valid-refresh',
        expiresAt: futureDate,
        user: { id: 'uuid-1', email: 'test@example.com', role: 'USER' },
      });

      const result = await service.refresh('valid-refresh');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException for expired refresh token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'expired-refresh',
        expiresAt: pastDate,
        user: { id: 'uuid-1', email: 'test@example.com', role: 'USER' },
      });

      await expect(service.refresh('expired-refresh')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('should delete the refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'valid-refresh',
      });

      await service.logout('valid-refresh');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });

    it('should not throw if refresh token does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.logout('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
      });

      const result = await service.getProfile('uuid-1');

      expect(result).toEqual({
        id: 'uuid-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
      });
    });
  });
});
