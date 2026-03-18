import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestApp } from './helpers/setup';

describe('Audit Trail + Activity Feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const ctx = await setupTestApp({
      email: `e2e-audit-admin-${Date.now()}@test.com`,
      password: 'TestPass123!', // NOSONAR — test fixture
      name: 'E2E Audit Admin',
    });
    app = ctx.app;
    prisma = ctx.prisma;

    // Promote to admin
    await prisma.user.updateMany({
      where: { email: { contains: 'e2e-audit-admin' } },
      data: { role: 'ADMIN' },
    });
    adminToken = ctx.accessToken;

    // Create a regular user
    const userEmail = `e2e-audit-user-${Date.now()}@test.com`;
    await request(app.getHttpServer()).post('/auth/register').send({
      email: userEmail,
      password: 'TestPass123!', // NOSONAR — test fixture
      name: 'E2E Audit User',
    });
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: 'TestPass123!' }); // NOSONAR
    userToken = userLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('AuditInterceptor', () => {
    it('should auto-log mutation requests', async () => {
      // Make a POST mutation (register already happened in setup)
      // The interceptor should have logged it
      // Wait briefly for async audit writes
      await new Promise((resolve) => setTimeout(resolve, 500));

      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const log = res.body.data.items[0];
      expect(log.action).toBeDefined();
      expect(log.resource).toBeDefined();
      expect(log.statusCode).toBeDefined();
    });
  });

  describe('GET /audit-logs', () => {
    it('should return paginated audit logs for admin', () => {
      return request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          expect(res.body.data.pagination).toBeDefined();
        });
    });

    it('should reject non-admin access', () => {
      return request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should filter by resource', () => {
      return request(app.getHttpServer())
        .get('/audit-logs?resource=auth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          for (const item of res.body.data.items) {
            expect(item.resource).toBe('auth');
          }
        });
    });
  });

  describe('GET /audit-logs/:id', () => {
    it('should return full audit log detail', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      const firstId = listRes.body.data.items[0]?.id;
      if (!firstId) return;

      return request(app.getHttpServer())
        .get(`/audit-logs/${firstId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(firstId);
          expect(res.body.data.action).toBeDefined();
        });
    });
  });

  describe('Activity Feed', () => {
    beforeAll(async () => {
      // Create activity entries directly
      const user = await prisma.user.findFirst({
        where: { email: { contains: 'e2e-audit-user' } },
      });
      if (user) {
        await prisma.activity.create({
          data: {
            userId: user.id,
            type: 'WEBHOOK_CREATED',
            message: 'You created a webhook',
            resource: 'webhook',
            resourceId: 'wh-test',
          },
        });
      }
    });

    it('should return user activity feed', () => {
      return request(app.getHttpServer())
        .get('/activity')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          expect(res.body.data.items.length).toBeGreaterThan(0);
          expect(res.body.data.items[0].type).toBe('WEBHOOK_CREATED');
        });
    });

    it('should not return other user activities', () => {
      return request(app.getHttpServer())
        .get('/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          // Admin shouldn't see user's activities (scoped by userId)
          const hasUserActivity = res.body.data.items.some(
            (i: { type: string }) => i.type === 'WEBHOOK_CREATED',
          );
          expect(hasUserActivity).toBe(false);
        });
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer()).get('/activity').expect(401);
    });
  });
});
