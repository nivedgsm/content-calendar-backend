import { Transform, Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMarketingActivityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  clientId!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  creativeName!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsDateString()
  uploadedAt!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  spendRupees!: number;

  @IsOptional()
  @IsDateString()
  takenDownAt?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePublicId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateMarketingActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  clientId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  creativeName?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsDateString()
  uploadedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  spendRupees?: number;

  @IsOptional()
  @IsDateString()
  takenDownAt?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePublicId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
