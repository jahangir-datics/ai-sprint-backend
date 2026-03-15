import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginResponseData {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;
}

export class RegisterResponseData {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  name: string | null;
}

export class UserProfileData {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  name: string | null;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'USER'] })
  role: string;
}

export class RefreshResponseData {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;
}
