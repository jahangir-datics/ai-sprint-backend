import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';
import { IsWebhookUrl } from '../validators/url.validator.js';

export class CreateWebhookDto {
  @ApiProperty({
    example: 'My Production Webhook',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'https://example.com/webhooks/platform' })
  @IsWebhookUrl()
  url: string;

  @ApiPropertyOptional({
    example: 'Receives user lifecycle events',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: ['user.created', 'api_key.revoked'],
    enum: WEBHOOK_EVENT_TYPES,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn([...WEBHOOK_EVENT_TYPES], { each: true })
  subscribedEvents: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
