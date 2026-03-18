import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateFeatureFlagDto } from './create-feature-flag.dto.js';

export class UpdateFeatureFlagDto extends PartialType(
  OmitType(CreateFeatureFlagDto, ['key'] as const),
) {}
