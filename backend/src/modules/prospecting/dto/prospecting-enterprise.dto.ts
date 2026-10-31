import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  BusinessOwnershipType,
  BusinessPainLifecycleStatus,
  CompanyPainCategory,
  ContactChannel,
  ContactOutcome,
  EmailDeliveryEvent,
  PhoneLineType,
  ProspectedLeadStatus,
  RecipientRole,
} from '@prisma/client';

const parseOptionalBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

export class GetLeadsQueryDto {
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsEnum(BusinessOwnershipType)
  @IsOptional()
  ownershipType?: BusinessOwnershipType;

  @IsEnum(CompanyPainCategory)
  @IsOptional()
  pain?: CompanyPainCategory;

  @IsString()
  @IsOptional()
  painCode?: string;

  @IsEnum(PhoneLineType)
  @IsOptional()
  phoneType?: PhoneLineType;

  @IsEnum(ProspectedLeadStatus)
  @IsOptional()
  status?: ProspectedLeadStatus;

  @Transform(parseOptionalBoolean)
  @IsBoolean()
  @IsOptional()
  excludeChains?: boolean;

  @Transform(parseOptionalBoolean)
  @IsBoolean()
  @IsOptional()
  excludeCooldown?: boolean;

  @Transform(parseOptionalBoolean)
  @IsBoolean()
  @IsOptional()
  includeBlacklisted?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  @IsOptional()
  limit?: number;
}

export class UpsertPainCatalogDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;

  @IsEnum(CompanyPainCategory)
  @IsOptional()
  categoryEnum?: CompanyPainCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  suggestedOffer!: string;

  @IsNumber()
  @Min(0)
  baseTicketUsd!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyRetainerUsd?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  priorityWeight?: number;

  @IsString()
  @IsNotEmpty()
  pitchTemplateOwner!: string;

  @IsString()
  @IsNotEmpty()
  pitchTemplateGatekeeper!: string;

  @IsString()
  @IsNotEmpty()
  pitchTemplateEnterprise!: string;

  @IsObject()
  @IsOptional()
  detectionRules?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBusinessPainStatusDto {
  @IsEnum(BusinessPainLifecycleStatus)
  status!: BusinessPainLifecycleStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  dismissReason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  verifiedBy?: string;
}

export class CreateContactLogDto {
  @IsEnum(ContactChannel)
  channel!: ContactChannel;

  @IsEnum(RecipientRole)
  @IsOptional()
  recipientRole?: RecipientRole;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  painCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  pitchToneUsed?: string;

  @IsEnum(ContactOutcome)
  outcome!: ContactOutcome;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsDateString()
  @IsOptional()
  nextFollowupDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  emailSubject?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  emailMessageId?: string;

  @IsBoolean()
  @IsOptional()
  forceOverrideCooldown?: boolean;
}

export class BlacklistLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class UpdateLeadStatusDto {
  @IsEnum(ProspectedLeadStatus)
  status!: ProspectedLeadStatus;
}

export class EmailWebhookEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  emailMessageId!: string;

  @IsEnum(EmailDeliveryEvent)
  event!: EmailDeliveryEvent;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

