import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsIn,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WEBHOOK_EVENT_TYPES } from '../webhook-event-types.js';

export class ListWebhooksQueryDto {
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
