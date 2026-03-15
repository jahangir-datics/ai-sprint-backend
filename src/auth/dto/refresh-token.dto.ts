import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'uuid-refresh-token' })
  @IsNotEmpty()
  @IsUUID('4')
  refreshToken: string;
}
