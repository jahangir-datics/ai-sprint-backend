import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookEventsService } from './webhook-events.service.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';
import { WebhookQueueProcessor } from './webhook-queue.processor.js';

@Module({
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookEventsService,
    WebhookDeliveryService,
    WebhookQueueProcessor,
  ],
  exports: [WebhookEventsService],
})
export class WebhooksModule {}
