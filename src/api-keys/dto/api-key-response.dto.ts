import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyCreatedData {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Full API key — shown only once' })
  key: string;

  @ApiProperty({ example: 'ask_ab12' })
  keyPrefix: string;

  @ApiProperty()
  name: string;
}

export class ApiKeyListItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'ask_ab12' })
  keyPrefix: string;

  @ApiProperty({ example: ['read', 'write'] })
  scopes: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  lastUsedAt: Date | null;

  @ApiPropertyOptional()
  expiresAt: Date | null;
}
