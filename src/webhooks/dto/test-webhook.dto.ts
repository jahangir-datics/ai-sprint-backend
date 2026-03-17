import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';

export class TestWebhookDto {
  @ApiProperty({ example: 'webhook.created', enum: WEBHOOK_EVENT_TYPES })
  @IsString()
  @IsIn([...WEBHOOK_EVENT_TYPES])
  eventType: string;
}
