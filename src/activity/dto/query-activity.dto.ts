import { IsOptional, IsString, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../webhooks/dto/pagination-query.dto.js';

export class QueryActivityDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'API_KEY_CREATED' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}
