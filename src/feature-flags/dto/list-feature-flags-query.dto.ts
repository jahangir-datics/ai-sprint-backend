import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../webhooks/dto/pagination-query.dto.js';

export class ListFeatureFlagsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;
}
