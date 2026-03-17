import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Webhooks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let createdWebhookId: string;

  const testUser = {
    email: `e2e-webhooks-${Date.now()}@test.com`,
    password: 'TestPass123!', // NOSONAR — test fixture
    name: 'E2E Webhooks User',
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
    await request(app.getHttpServer()).post('/auth/register').send(testUser);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password }); // NOSONAR
    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.webhook.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /webhooks', () => {
    it('should create a webhook and return secret once', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Webhook',
          url: 'https://example.com/hook',
          subscribedEvents: ['user.created', 'api_key.revoked'],
          description: 'A test webhook',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.name).toBe('Test Webhook');
          expect(res.body.data.url).toBe('https://example.com/hook');
          expect(res.body.data.secret).toMatch(/^whsec_[a-f0-9]{64}$/);
          expect(res.body.data.subscribedEvents).toEqual([
            'user.created',
            'api_key.revoked',
          ]);
          expect(res.body.data.isActive).toBe(true);
          expect(res.body.message).toBe('Webhook created successfully');
          createdWebhookId = res.body.data.id;
        });
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .send({
          name: 'No Auth Webhook',
          url: 'https://example.com/hook',
          subscribedEvents: ['user.created'],
        })
        .expect(401);
    });

    it('should reject invalid URL (localhost)', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bad Webhook',
          url: 'http://localhost:3000/hook',
          subscribedEvents: ['user.created'],
        })
        .expect(400);
    });

    it('should reject invalid event types', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bad Events Webhook',
          url: 'https://example.com/hook',
          subscribedEvents: ['invalid.event'],
        })
        .expect(400);
    });

    it('should reject empty subscribedEvents', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Empty Events',
          url: 'https://example.com/hook',
          subscribedEvents: [],
        })
        .expect(400);
    });

    it('should reject short name', () => {
      return request(app.getHttpServer())
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Ab',
          url: 'https://example.com/hook',
          subscribedEvents: ['user.created'],
        })
        .expect(400);
    });
  });

  describe('GET /webhooks', () => {
    it('should list user webhooks', () => {
      return request(app.getHttpServer())
        .get('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          expect(res.body.data.items.length).toBeGreaterThan(0);
          expect(res.body.data.pagination).toBeDefined();
          // Secret should NOT be in list response
          const webhook = res.body.data.items[0];
          expect(webhook.secret).toBeUndefined();
        });
    });
  });

  describe('GET /webhooks/event-types', () => {
    it('should return supported event types', () => {
      return request(app.getHttpServer())
        .get('/webhooks/event-types')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          expect(res.body.data.items.length).toBeGreaterThan(0);
          const first = res.body.data.items[0];
          expect(first.key).toBeDefined();
          expect(first.description).toBeDefined();
        });
    });
  });

  describe('GET /webhooks/:id', () => {
    it('should return webhook without secret', () => {
      return request(app.getHttpServer())
        .get(`/webhooks/${createdWebhookId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(createdWebhookId);
          expect(res.body.data.name).toBe('Test Webhook');
          expect(res.body.data.secret).toBeUndefined();
        });
    });

    it('should return 404 for non-existent webhook', () => {
      return request(app.getHttpServer())
        .get('/webhooks/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /webhooks/:id', () => {
    it('should update webhook name', () => {
      return request(app.getHttpServer())
        .patch(`/webhooks/${createdWebhookId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Webhook' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe('Updated Webhook');
          expect(res.body.message).toBe('Webhook updated successfully');
        });
    });
  });

  describe('POST /webhooks/:id/activate & deactivate', () => {
    it('should deactivate a webhook', () => {
      return request(app.getHttpServer())
        .post(`/webhooks/${createdWebhookId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isActive).toBe(false);
        });
    });

    it('should activate a webhook', () => {
      return request(app.getHttpServer())
        .post(`/webhooks/${createdWebhookId}/activate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isActive).toBe(true);
        });
    });
  });

  describe('POST /webhooks/:id/test', () => {
    it('should queue a test event', () => {
      return request(app.getHttpServer())
        .post(`/webhooks/${createdWebhookId}/test`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ eventType: 'webhook.created' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.eventId).toBeDefined();
          expect(res.body.data.status).toBe('PENDING');
          expect(res.body.data.queued).toBe(true);
        });
    });

    it('should reject invalid event type for test', () => {
      return request(app.getHttpServer())
        .post(`/webhooks/${createdWebhookId}/test`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ eventType: 'invalid.type' })
        .expect(400);
    });
  });

  describe('GET /webhooks/:id/events', () => {
    it('should list events for webhook', () => {
      return request(app.getHttpServer())
        .get(`/webhooks/${createdWebhookId}/events`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toBeDefined();
          expect(res.body.data.items.length).toBeGreaterThan(0);
        });
    });
  });

  describe('DELETE /webhooks/:id', () => {
    it('should delete the webhook', () => {
      return request(app.getHttpServer())
        .delete(`/webhooks/${createdWebhookId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.deleted).toBe(true);
          expect(res.body.message).toBe('Webhook deleted successfully');
        });
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/webhooks/${createdWebhookId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
