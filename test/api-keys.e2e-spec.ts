import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API Keys (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let createdKeyId: string;
  let createdRawKey: string;

  const testUser = {
    email: `e2e-keys-${Date.now()}@test.com`,
    password: 'TestPass123!',
    name: 'E2E Keys User',
  };

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

    // Register and login
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /api-keys', () => {
    it('should create an API key and return it once', () => {
      return request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test Key', scopes: ['read', 'write'] })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.key).toMatch(/^ask_[a-f0-9]{32}$/);
          expect(res.body.data.keyPrefix).toBeDefined();
          expect(res.body.data.name).toBe('Test Key');
          expect(res.body.data.id).toBeDefined();
          expect(res.body.message).toBe('API key created');
          createdKeyId = res.body.data.id;
          createdRawKey = res.body.data.key;
        });
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .post('/api-keys')
        .send({ name: 'No Auth Key' })
        .expect(401);
    });

    it('should reject missing name', () => {
      return request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ scopes: ['read'] })
        .expect(400);
    });
  });

  describe('GET /api-keys', () => {
    it('should list user API keys without exposing hash', () => {
      return request(app.getHttpServer())
        .get('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
          const key = res.body.data[0];
          expect(key.keyPrefix).toBeDefined();
          expect(key.name).toBeDefined();
          expect(key.keyHash).toBeUndefined();
          expect(key.key).toBeUndefined();
        });
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key via X-API-Key header', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('X-API-Key', createdRawKey)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.email).toBe(testUser.email);
        });
    });

    it('should reject invalid API key', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('X-API-Key', 'ask_invalidkey1234567890abcdef12')
        .expect(401);
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('should revoke an API key', () => {
      return request(app.getHttpServer())
        .delete(`/api-keys/${createdKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeNull();
          expect(res.body.message).toBe('API key revoked');
        });
    });

    it('should reject authentication with revoked key', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('X-API-Key', createdRawKey)
        .expect(401);
    });

    it('should return 404 for non-existent key', () => {
      return request(app.getHttpServer())
        .delete('/api-keys/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
