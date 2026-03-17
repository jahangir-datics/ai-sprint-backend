import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DeliveryResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private static readonly TIMEOUT_MS = 5000;

  constructor(private readonly prisma: PrismaService) {}

  sign(secret: string, timestamp: number, body: string): string {
    const signedPayload = `${timestamp}.${body}`;
    return createHmac('sha256', secret).update(signedPayload).digest('hex');
  }

  async deliver(
    webhookEventId: string,
    attemptNumber: number,
    url: string,
    secret: string,
    webhookId: string,
    eventType: string,
    payload: unknown,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.sign(secret, timestamp, body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Developer-Platform-Webhooks/1.0',
      'X-Webhook-Id': webhookId,
      'X-Webhook-Event-Id': webhookEventId,
      'X-Webhook-Event-Type': eventType,
      'X-Webhook-Timestamp': String(timestamp),
      'X-Webhook-Signature': `sha256=${signature}`,
    };

    const start = Date.now();
    let result: DeliveryResult;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        WebhookDeliveryService.TIMEOUT_MS,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        redirect: 'error',
      });

      clearTimeout(timeout);
      const durationMs = Date.now() - start;
      const responseBody = await response.text().catch(() => null);

      if (response.ok) {
        result = {
          success: true,
          status: 'SUCCESS',
          responseCode: response.status,
          responseBody,
          errorMessage: null,
          durationMs,
        };
      } else {
        result = {
          success: false,
          status: 'FAILED',
          responseCode: response.status,
          responseBody,
          errorMessage: `HTTP ${response.status} ${response.statusText}`,
          durationMs,
        };
      }
    } catch (error) {
      const durationMs = Date.now() - start;
      const isTimeout =
        error instanceof DOMException && error.name === 'AbortError';

      result = {
        success: false,
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        responseCode: null,
        responseBody: null,
        errorMessage: isTimeout
          ? `Request timed out after ${WebhookDeliveryService.TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'Unknown error',
        durationMs,
      };
    }

    await this.prisma.webhookDelivery.create({
      data: {
        webhookEventId,
        attemptNumber,
        status: result.status,
        responseCode: result.responseCode,
        responseBody: result.responseBody?.substring(0, 10000) ?? null,
        errorMessage: result.errorMessage,
        durationMs: result.durationMs,
        requestHeaders: headers,
        requestBody: payload as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Delivery ${webhookEventId} attempt #${attemptNumber}: ${result.status} (${result.durationMs}ms)`,
    );

    return result;
  }

  shouldRetry(result: DeliveryResult): boolean {
    if (result.success) return false;
    if (result.status === 'TIMEOUT') return true;
    if (result.responseCode === null) return true;
    if (result.responseCode === 429) return true;
    if (result.responseCode >= 500) return true;
    return false;
  }
}
