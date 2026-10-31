import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BusinessPainLifecycleStatus,
  ContactChannel,
  ContactOutcome,
  EmailDeliverabilityStatus,
  EmailDeliveryEvent,
  ProspectedLeadStatus,
  RecipientRole,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantContextService } from '../../../core/context/tenant-context.service';

export interface RecordContactInput {
  businessId: string;
  painCode?: string;
  channel: ContactChannel;
  recipientRole?: RecipientRole;
  pitchToneUsed?: string;
  outcome: ContactOutcome;
  notes?: string;
  nextFollowupDate?: string;
  emailSubject?: string;
  emailMessageId?: string;
  forceOverrideCooldown?: boolean;
}

export interface EmailTelemetryWebhookInput {
  emailMessageId: string;
  event: EmailDeliveryEvent;
  occurredAt?: string;
  reason?: string;
}

@Injectable()
export class ContactCooldownPolicyService {
  private readonly logger = new Logger(ContactCooldownPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  getDefaultCooldownDays(): number {
    const raw = Number(this.configService.get<string>('PROSPECT_COOLDOWN_DAYS') || 30);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  }

  async recordContactInteraction(input: RecordContactInput) {
    const tenantId = this.tenantContext.getTenantId();
    const userEmail = this.tenantContext.getUserEmail() || this.tenantContext.getUserId() || 'system';
    const userRole = (this.tenantContext.getUserRole() || '').toUpperCase();

    const business = await this.prisma.prospectedBusiness.findFirst({
      where: { id: input.businessId, tenantId },
      include: {
        contactLogs: {
          orderBy: { contactedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!business) {
      throw new NotFoundException(`Prospected business ${input.businessId} not found in tenant`);
    }

    // 1. Enforce Do-Not-Contact Blacklist strictly
    if (business.doNotContact && input.outcome !== ContactOutcome.OPT_OUT_BLACKLIST) {
      throw new ConflictException(
        `Business "${business.name}" is on the Do-Not-Contact blacklist (${business.doNotContactReason || 'opted out'}). Outbound outreach is blocked.`,
      );
    }

    // 2. Enforce 30-day Anti-Spam Cooldown unless prior interaction was MEETING_SCHEDULED or explicit admin override
    const now = new Date();
    const latestContact = business.contactLogs[0];
    const priorWasMeetingScheduled = latestContact?.outcome === ContactOutcome.MEETING_SCHEDULED;

    if (
      business.contactCooldownUntil &&
      business.contactCooldownUntil > now &&
      !priorWasMeetingScheduled &&
      input.outcome !== ContactOutcome.OPT_OUT_BLACKLIST
    ) {
      if (input.forceOverrideCooldown) {
        if (!this.tenantContext.isAuthenticated() || (userRole !== 'OWNER' && userRole !== 'ADMIN')) {
          throw new ForbiddenException(
            'Only authenticated OWNER or ADMIN users can override an active contact cooldown',
          );
        }
      } else {
        throw new ConflictException(
          `Anti-spam cooldown active for "${business.name}" until ${business.contactCooldownUntil.toISOString()}. Wait for cooldown expiration or schedule follow-up from an active meeting.`,
        );
      }
    }

    let resolvedPainCatalogId: string | undefined;
    if (input.painCode) {
      const cat = await this.prisma.companyPainCatalog.findUnique({
        where: { code: input.painCode.toUpperCase() },
      });
      resolvedPainCatalogId = cat?.id;
    }

    const cooldownDays = this.getDefaultCooldownDays();
    const nextCooldownUntil = new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
    const isOptOut = input.outcome === ContactOutcome.OPT_OUT_BLACKLIST;

    return this.prisma.$transaction(async (tx) => {
      const createdLog = await tx.prospectContactLog.create({
        data: {
          tenantId,
          businessId: business.id,
          painCatalogId: resolvedPainCatalogId,
          contactedBy: userEmail,
          channel: input.channel,
          recipientRole: input.recipientRole ?? RecipientRole.UNKNOWN,
          pitchToneUsed: input.pitchToneUsed,
          outcome: input.outcome,
          notes: input.notes,
          nextFollowupDate: input.nextFollowupDate ? new Date(input.nextFollowupDate) : null,
          emailSubject: input.emailSubject,
          emailMessageId: input.emailMessageId,
          emailEvent:
            input.channel === ContactChannel.EMAIL ? EmailDeliveryEvent.SENT : undefined,
          contactedAt: now,
        },
      });

      const updatedBusiness = await tx.prospectedBusiness.update({
        where: { id: business.id },
        data: {
          lastContactedAt: now,
          contactCooldownUntil: nextCooldownUntil,
          contactAttemptsCount: { increment: 1 },
          status: isOptOut ? ProspectedLeadStatus.DISQUALIFIED : ProspectedLeadStatus.CONTACTED,
          ...(isOptOut
            ? {
                doNotContact: true,
                doNotContactReason: input.notes || 'Opted out during outreach interaction',
              }
            : {}),
        },
      });

      // Automatically advance M:N pain lifecycle if a pain offer was pitched or closed-won
      if (resolvedPainCatalogId) {
        if (input.outcome === ContactOutcome.CLOSED_WON) {
          await tx.prospectedBusinessPain.updateMany({
            where: {
              businessId: business.id,
              painCatalogId: resolvedPainCatalogId,
            },
            data: {
              status: BusinessPainLifecycleStatus.RESOLVED_BY_US,
              resolvedAt: now,
              verifiedBy: userEmail,
            },
          });
        } else {
          await tx.prospectedBusinessPain.updateMany({
            where: {
              businessId: business.id,
              painCatalogId: resolvedPainCatalogId,
              status: {
                in: [BusinessPainLifecycleStatus.DETECTED, BusinessPainLifecycleStatus.VERIFIED],
              },
            },
            data: {
              status: BusinessPainLifecycleStatus.PITCHED,
            },
          });
        }
      }

      return {
        contactLog: createdLog,
        businessSummary: {
          id: updatedBusiness.id,
          status: updatedBusiness.status,
          lastContactedAt: updatedBusiness.lastContactedAt,
          contactCooldownUntil: updatedBusiness.contactCooldownUntil,
          contactAttemptsCount: updatedBusiness.contactAttemptsCount,
          doNotContact: updatedBusiness.doNotContact,
        },
      };
    });
  }

  async blacklistBusiness(businessId: string, reason: string) {
    const tenantId = this.tenantContext.getTenantId();
    const userEmail = this.tenantContext.getUserEmail() || this.tenantContext.getUserId() || 'system';

    const business = await this.prisma.prospectedBusiness.findFirst({
      where: { id: businessId, tenantId },
    });

    if (!business) {
      throw new NotFoundException(`Prospected business ${businessId} not found in tenant`);
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.prospectedBusiness.update({
        where: { id: business.id },
        data: {
          doNotContact: true,
          doNotContactReason: reason,
          status: ProspectedLeadStatus.DISQUALIFIED,
        },
      });

      await tx.prospectContactLog.create({
        data: {
          tenantId,
          businessId: business.id,
          contactedBy: userEmail,
          channel: ContactChannel.WHATSAPP,
          recipientRole: RecipientRole.UNKNOWN,
          outcome: ContactOutcome.OPT_OUT_BLACKLIST,
          notes: reason,
          contactedAt: now,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        doNotContact: updated.doNotContact,
        doNotContactReason: updated.doNotContactReason,
        status: updated.status,
      };
    });
  }

  async handleEmailTelemetryWebhook(input: EmailTelemetryWebhookInput) {
    const log = await this.prisma.prospectContactLog.findUnique({
      where: { emailMessageId: input.emailMessageId },
    });

    if (!log) {
      this.logger.warn(`Email webhook received for unknown messageId: ${input.emailMessageId}`);
      return { processed: false, reason: 'MESSAGE_ID_NOT_FOUND' };
    }

    const eventTimestamp = input.occurredAt ? new Date(input.occurredAt) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.prospectContactLog.update({
        where: { id: log.id },
        data: {
          emailEvent: input.event,
          ...(input.event === EmailDeliveryEvent.OPENED ? { openedAt: eventTimestamp } : {}),
          ...(input.event === EmailDeliveryEvent.CLICKED ? { clickedAt: eventTimestamp } : {}),
          ...(input.event === EmailDeliveryEvent.REPLIED ? { repliedAt: eventTimestamp } : {}),
          ...(input.event === EmailDeliveryEvent.BOUNCED ? { bouncedAt: eventTimestamp } : {}),
        },
      });

      if (input.event === EmailDeliveryEvent.BOUNCED) {
        await tx.prospectedBusiness.update({
          where: { id: log.businessId },
          data: {
            emailDeliverability: EmailDeliverabilityStatus.INVALID_BOUNCE,
          },
        });
      } else if (input.event === EmailDeliveryEvent.DELIVERED) {
        await tx.prospectedBusiness.update({
          where: { id: log.businessId },
          data: {
            emailDeliverability: EmailDeliverabilityStatus.VERIFIED,
          },
        });
      } else if (input.event === EmailDeliveryEvent.SPAM_COMPLAINT) {
        await tx.prospectedBusiness.update({
          where: { id: log.businessId },
          data: {
            doNotContact: true,
            doNotContactReason:
              input.reason || 'Automated blacklist triggered by email SPAM_COMPLAINT event',
            status: ProspectedLeadStatus.DISQUALIFIED,
          },
        });
      }
    });

    return {
      processed: true,
      contactLogId: log.id,
      businessId: log.businessId,
      event: input.event,
    };
  }
}

