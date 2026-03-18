import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvaluateFlagDto {
  @ApiProperty({ example: 'new_dashboard' })
  @IsString()
  @IsNotEmpty()
  flagKey: string;

  @ApiProperty({ example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ example: ['USER'] })
  @IsOptional()
  @IsArray()
  @IsIn(['ADMIN', 'MANAGER', 'USER'], { each: true })
  userRoles?: string[];
}
