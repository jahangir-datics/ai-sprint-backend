import { IsOptional, IsBoolean, IsIn, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

export class ListWebhooksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: WEBHOOK_EVENT_TYPES })
  @IsOptional()
  @IsString()
  @IsIn([...WEBHOOK_EVENT_TYPES])
  eventType?: string;
}
