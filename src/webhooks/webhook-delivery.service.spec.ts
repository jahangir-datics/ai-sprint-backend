import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let prisma: { webhookDelivery: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { webhookDelivery: { create: jest.fn().mockResolvedValue({}) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WebhookDeliveryService>(WebhookDeliveryService);
  });

  describe('sign', () => {
    it('should produce consistent HMAC-SHA256 signatures', () => {
      const sig1 = service.sign('secret', 1710496800, '{"test":true}');
      const sig2 = service.sign('secret', 1710496800, '{"test":true}');
      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different signatures for different secrets', () => {
      const sig1 = service.sign('secret1', 1710496800, '{"test":true}');
      const sig2 = service.sign('secret2', 1710496800, '{"test":true}');
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different timestamps', () => {
      const sig1 = service.sign('secret', 1710496800, '{"test":true}');
      const sig2 = service.sign('secret', 1710496801, '{"test":true}');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('shouldRetry', () => {
    it('should not retry on success', () => {
      expect(
        service.shouldRetry({
          success: true,
          status: 'SUCCESS',
          responseCode: 200,
          responseBody: null,
          errorMessage: null,
          durationMs: 100,
        }),
      ).toBe(false);
    });

    it('should retry on timeout', () => {
      expect(
        service.shouldRetry({
          success: false,
          status: 'TIMEOUT',
          responseCode: null,
          responseBody: null,
          errorMessage: 'timeout',
          durationMs: 5000,
        }),
      ).toBe(true);
    });

    it('should retry on 5xx', () => {
      expect(
        service.shouldRetry({
          success: false,
          status: 'FAILED',
          responseCode: 502,
          responseBody: null,
          errorMessage: 'Bad Gateway',
          durationMs: 100,
        }),
      ).toBe(true);
    });

    it('should retry on 429', () => {
      expect(
        service.shouldRetry({
          success: false,
          status: 'FAILED',
          responseCode: 429,
          responseBody: null,
          errorMessage: 'Too Many Requests',
          durationMs: 100,
        }),
      ).toBe(true);
    });

    it('should not retry on 4xx (except 429)', () => {
      expect(
        service.shouldRetry({
          success: false,
          status: 'FAILED',
          responseCode: 404,
          responseBody: null,
          errorMessage: 'Not Found',
          durationMs: 100,
        }),
      ).toBe(false);
    });

    it('should retry when no response code (network error)', () => {
      expect(
        service.shouldRetry({
          success: false,
          status: 'FAILED',
          responseCode: null,
          responseBody: null,
          errorMessage: 'ECONNREFUSED',
          durationMs: 100,
        }),
      ).toBe(true);
    });
  });
});
