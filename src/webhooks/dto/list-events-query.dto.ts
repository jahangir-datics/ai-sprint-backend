import { IsOptional, IsInt, Min, Max, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';

const EVENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'DELIVERED',
  'FAILED',
] as const;

export class ListEventsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

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
