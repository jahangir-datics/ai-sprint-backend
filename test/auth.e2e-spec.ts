import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  const testUser = {
    email: `e2e-auth-${Date.now()}@test.com`,
    password: 'TestPass123!',
    name: 'E2E Auth User',
  };

  let accessToken: string;
  let refreshToken: string;

  describe('POST /auth/register', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.name).toBe(testUser.name);
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.password).toBeUndefined();
          expect(res.body.message).toBe('User registered successfully');
        });
    });

    it('should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'TestPass123!' })
        .expect(400);
    });

    it('should reject short password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
          expect(res.body.data.expiresIn).toBe(900);
          expect(res.body.message).toBe('Login successful');
          accessToken = res.body.data.accessToken;
          refreshToken = res.body.data.refreshToken;
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'TestPass123!' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.role).toBe('USER');
          expect(res.body.data.password).toBeUndefined();
          expect(res.body.message).toBe('User profile retrieved');
        });
    });

    it('should reject request without token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new access token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.expiresIn).toBe(900);
          expect(res.body.message).toBe('Token refreshed');
        });
    });

    it('should reject malformed refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(400);
    });

    it('should reject non-existent refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: '00000000-0000-4000-8000-000000000000' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeNull();
          expect(res.body.message).toBe('Logged out successfully');
        });
    });

    it('should reject refresh after logout', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
