import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  agencyName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken?: string;
}

export class InviteClientDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  name?: string;
}
