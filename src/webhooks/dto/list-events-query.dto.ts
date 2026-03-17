import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

const EVENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'DELIVERED',
  'FAILED',
] as const;

export class ListEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EVENT_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn([...EVENT_STATUSES])
  status?: string;

  @ApiPropertyOptional({ enum: WEBHOOK_EVENT_TYPES })
  @IsOptional()
  @IsString()
  @IsIn([...WEBHOOK_EVENT_TYPES])
  eventType?: string;
}
