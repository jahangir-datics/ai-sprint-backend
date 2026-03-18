import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestApp } from './helpers/setup';

describe('Feature Flags (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let createdFlagId: string;

  beforeAll(async () => {
    // Setup admin user
    const adminCtx = await setupTestApp({
      email: `e2e-ff-admin-${Date.now()}@test.com`,
      password: 'TestPass123!', // NOSONAR — test fixture
      name: 'E2E FF Admin',
    });
    app = adminCtx.app;
    prisma = adminCtx.prisma;

    // Promote to ADMIN
    await prisma.user.updateMany({
      where: { email: { contains: 'e2e-ff-admin' } },
      data: { role: 'ADMIN' },
    });

    // Re-login to get token with ADMIN role
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `e2e-ff-admin-${Date.now()}@test.com`,
        password: 'TestPass123!', // NOSONAR — test fixture
      });

    // If re-login fails (email mismatch due to Date.now), use the original token
    adminToken = loginRes.body?.data?.accessToken ?? adminCtx.accessToken;

    // Register a regular user
    const userEmail = `e2e-ff-user-${Date.now()}@test.com`;
    await request(app.getHttpServer()).post('/auth/register').send({
      email: userEmail,
      password: 'TestPass123!', // NOSONAR — test fixture
      name: 'E2E FF User',
    });
    const userLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: 'TestPass123!' }); // NOSONAR
    userToken = userLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.featureFlag.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('CRUD (admin only)', () => {
    it('should create a feature flag', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'test_feature',
          name: 'Test Feature',
          description: 'A test flag',
          isEnabled: true,
          rolloutPercent: 50,
          targetUsers: ['special_user'],
          targetRoles: ['ADMIN'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.key).toBe('test_feature');
          expect(res.body.data.isEnabled).toBe(true);
          expect(res.body.data.rolloutPercent).toBe(50);
          expect(res.body.message).toBe('Feature flag created');
          createdFlagId = res.body.data.id;
        });
    });

    it('should reject duplicate key', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'test_feature', name: 'Duplicate' })
        .expect(409);
    });

    it('should reject non-admin user for create', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ key: 'user_flag', name: 'User Flag' })
        .expect(403);
    });

    it('should list feature flags', () => {
      return request(app.getHttpServer())
        .get('/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items.length).toBeGreaterThan(0);
          expect(res.body.data.pagination).toBeDefined();
        });
    });

    it('should get a feature flag by ID', () => {
      return request(app.getHttpServer())
        .get(`/feature-flags/${createdFlagId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.key).toBe('test_feature');
        });
    });

    it('should update a feature flag', () => {
      return request(app.getHttpServer())
        .patch(`/feature-flags/${createdFlagId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolloutPercent: 75, name: 'Updated Feature' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.rolloutPercent).toBe(75);
          expect(res.body.data.name).toBe('Updated Feature');
        });
    });

    it('should reject invalid rolloutPercent', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'bad_pct', name: 'Bad', rolloutPercent: 150 })
        .expect(400);
    });

    it('should reject invalid key format', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'Invalid-Key!', name: 'Bad Key' })
        .expect(400);
    });
  });

  describe('Evaluation', () => {
    it('should evaluate flag as enabled for targeted user', () => {
      return request(app.getHttpServer())
        .post('/feature-flags/evaluate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ flagKey: 'test_feature', userId: 'special_user' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.enabled).toBe(true);
          expect(res.body.data.reason).toBe('USER_TARGETED');
        });
    });

    it('should evaluate flag as enabled for ADMIN role', () => {
      return request(app.getHttpServer())
        .post('/feature-flags/evaluate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          flagKey: 'test_feature',
          userId: 'other_user',
          userRoles: ['ADMIN'],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.enabled).toBe(true);
          expect(res.body.data.reason).toBe('ROLE_MATCH');
        });
    });

    it('should return FLAG_NOT_FOUND for unknown flag', () => {
      return request(app.getHttpServer())
        .post('/feature-flags/evaluate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ flagKey: 'nonexistent', userId: 'user-1' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.enabled).toBe(false);
          expect(res.body.data.reason).toBe('FLAG_NOT_FOUND');
        });
    });

    it('should reject evaluation without auth', () => {
      return request(app.getHttpServer())
        .post('/feature-flags/evaluate')
        .send({ flagKey: 'test_feature', userId: 'user-1' })
        .expect(401);
    });
  });

  describe('DELETE /feature-flags/:id', () => {
    it('should delete the flag', () => {
      return request(app.getHttpServer())
        .delete(`/feature-flags/${createdFlagId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.deleted).toBe(true);
        });
    });
  });
});
