import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';

class MarketingImageDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePublicId?: string;
}

class MarketingMetricsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MarketingImageDto)
  images?: MarketingImageDto[];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  showDailySpendToClient?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  totalImpressions?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  totalReach?: number | null;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(2000)
  totalResult?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  costPerResult?: number | null;
}

export class CreateMarketingActivityDto extends MarketingMetricsDto {
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

export class UpdateMarketingActivityDto extends MarketingMetricsDto {
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
