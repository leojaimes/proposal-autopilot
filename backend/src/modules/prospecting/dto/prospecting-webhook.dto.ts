import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WebhookLeadItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  category?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(180)
  email?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  reviewsCount?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(4)
  priceLevel?: number;

  @IsString()
  @IsOptional()
  businessStatus?: string;

  @IsString()
  @IsOptional()
  lastReviewDate?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  reviewsSnippets?: string[];

  @IsOptional()
  primaryPain?: string;

  @IsNumber()
  @IsOptional()
  painConfidence?: number;

  @IsString()
  @IsOptional()
  suggestedOffer?: string;

  @IsString()
  @IsOptional()
  salesPitchDraft?: string;

  @IsObject()
  @IsOptional()
  painAnalysisDetails?: Record<string, unknown>;
}

export class ProspectingWebhookPayloadDto {
  @IsString()
  @IsIn(['SCAN_STARTED', 'LEADS_DISCOVERED', 'SCAN_COMPLETED', 'SCAN_FAILED'])
  event!: 'SCAN_STARTED' | 'LEADS_DISCOVERED' | 'SCAN_COMPLETED' | 'SCAN_FAILED';

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  scanId!: string;

  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'tenantId must be a canonical 36-char UUID',
  })
  tenantId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  query?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalFound?: number;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WebhookLeadItemDto)
  businesses?: WebhookLeadItemDto[];

  @IsString()
  @IsOptional()
  error?: string;
}

export class WebsiteDemoReadyWebhookDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsString()
  @IsNotEmpty()
  demoUrl!: string;

  @IsString()
  @IsOptional()
  screenshotUrl?: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;
}
