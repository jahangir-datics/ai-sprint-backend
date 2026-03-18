import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsArray,
  Matches,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'new_dashboard' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Key must be lowercase alphanumeric with underscores only',
  })
  key: string;

  @ApiProperty({ example: 'New Dashboard UI' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Enables redesigned dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @ApiPropertyOptional({ example: ['user_123'], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUsers?: string[];

  @ApiPropertyOptional({ example: ['ADMIN'], default: [] })
  @IsOptional()
  @IsArray()
  @IsIn(['ADMIN', 'MANAGER', 'USER'], { each: true })
  targetRoles?: string[];

  @ApiPropertyOptional({ default: 'production' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;
}
