import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { OrionSearchService } from '../../scraping/services/orion-search.service';
import { PhoneNormalizerService } from './phone-normalizer.service';
import { LambdaGoogleProspectingService } from './lambda-google-prospecting.service';
import { EmailValidationService, EmailValidationResultStatus } from './email-validation.service';
import { PhoneLineType, EmailDeliverabilityStatus } from '@prisma/client';

export interface DecisionMakerData {
  name: string;
  honorific?: string;
  role?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
}

export interface HighTicketServiceData {
  category: string;
  summary: string;
  keywordsFound: string[];
}

export interface GoogleKnowledgePanelSummary {
  title?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewsCount?: number;
  hours?: string;
  officialWebsiteUrl?: string;
}

export interface DeepIntelligenceResult {
  businessId: string;
  enrichedAt: string;
  knowledgePanel?: GoogleKnowledgePanelSummary;
  servicesCatalog?: HighTicketServiceData[];
  foundChannels: {
    whatsappUrl?: string;
    phone?: string;
    phoneType?: PhoneLineType;
    email?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
  };
  decisionMakers: DecisionMakerData[];
  digitalFootprint: {
    organicSnippet?: string;
    verifiedPlatforms: string[];
    hasDigitalPresence: boolean;
  };
  suggestedAngle: string;
}

@Injectable()
export class OrionDeepProspectEnricherService {
  private readonly logger = new Logger(OrionDeepProspectEnricherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orionSearch: OrionSearchService,
    private readonly phoneNormalizer: PhoneNormalizerService,
    private readonly emailValidation: EmailValidationService,
    @Optional() private readonly lambdaProspecting?: LambdaGoogleProspectingService,
  ) {}

  /**
   * Executes deep OSINT and web investigation on a prospected business.
   * Enforces truth hierarchy (protects SDR manual overrides, promotes mobile/WhatsApp, validates DNS MX),
   * and transactionally persists contacts and social profiles in 3NF relational models.
   */
  async enrichLeadDeeply(businessId: string, force = false): Promise<DeepIntelligenceResult> {
    const lead = await this.prisma.prospectedBusiness.findUnique({
      where: { id: businessId },
      include: {
        contacts: true,
        socialProfiles: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Prospect with ID ${businessId} not found`);
    }

    const rawData = (lead.rawGoogleData as Record<string, any>) || {};
    const existingIntelligence = rawData.deepIntelligence as DeepIntelligenceResult | undefined;

    // Cache guard: 7-day validity for zero wasted compute unless forced
    if (!force && existingIntelligence?.enrichedAt && lead.contacts.length > 0) {
      const ageMs = Date.now() - new Date(existingIntelligence.enrichedAt).getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) {
        this.logger.log(`Serving cached deep intelligence for ${lead.name} (${businessId})`);
        return existingIntelligence;
      }
    }

    this.logger.log(`Executing real-time deep search for: ${lead.name} in ${lead.city || lead.state}`);

    const cityContext = lead.city ? `${lead.city} ${lead.country || ''}` : lead.country || '';
    const query = `"${lead.name}" ${cityContext} telefono whatsapp correo email facebook instagram doctoralia`;

    const searchResults = await this.orionSearch.search(query, {
      searchDepth: 'advanced',
      maxResults: 6,
    }).catch((err) => {
      this.logger.warn(`Orion search fallback: ${err.message}`);
      return [];
    });

    const parsedChannels = this.extractContactChannels(searchResults, lead.country || 'Mexico');
    let decisionMakers = this.extractDecisionMakers(searchResults);
    let verifiedPlatforms = this.detectPlatforms(searchResults);
    let lambdaServicesCatalog: HighTicketServiceData[] = [];
    let lambdaKnowledgePanel: GoogleKnowledgePanelSummary | undefined;

    // Candidate URLs for parallel Lambda Fast-Path + Chromium Stealth scan
    const candidateUrlsToDeepScan = [
      lead.websiteUrl,
      parsedChannels.websiteUrl,
      ...searchResults.map((r) => r.url),
    ].filter((u): u is string => Boolean(u) && u.startsWith('http'));

    if (this.lambdaProspecting) {
      try {
        const lambdaResult = await this.lambdaProspecting.deepEnrichBusiness({
          businessName: lead.name,
          urls: Array.from(new Set(candidateUrlsToDeepScan)).slice(0, 4),
          city: lead.city || undefined,
          state: lead.state || undefined,
          country: lead.country || 'Mexico',
          address: lead.address || undefined,
        });

        if (lambdaResult?.servicesCatalog) {
          lambdaServicesCatalog = lambdaResult.servicesCatalog;
        }
        if (lambdaResult?.knowledgePanel) {
          lambdaKnowledgePanel = lambdaResult.knowledgePanel;
        }
        if (lambdaResult?.channels?.whatsappUrl && !parsedChannels.whatsappUrl) {
          parsedChannels.whatsappUrl = lambdaResult.channels.whatsappUrl;
        }
        if (lambdaResult?.channels?.phone && !parsedChannels.phone) {
          parsedChannels.phone = lambdaResult.channels.phone;
        }
        if (lambdaResult?.channels?.email && !parsedChannels.email) {
          parsedChannels.email = lambdaResult.channels.email;
        }
        if (lambdaResult?.channels?.facebookUrl && !parsedChannels.facebookUrl) {
          parsedChannels.facebookUrl = lambdaResult.channels.facebookUrl;
        }
        if (lambdaResult?.channels?.instagramUrl && !parsedChannels.instagramUrl) {
          parsedChannels.instagramUrl = lambdaResult.channels.instagramUrl;
        }
        if (lambdaResult?.channels?.linkedinUrl && !parsedChannels.linkedinUrl) {
          parsedChannels.linkedinUrl = lambdaResult.channels.linkedinUrl;
        }
        if (lambdaResult?.channels?.websiteUrl && !parsedChannels.websiteUrl && !lead.websiteUrl) {
          parsedChannels.websiteUrl = lambdaResult.channels.websiteUrl;
        }
        if (lambdaResult?.decisionMakers && lambdaResult.decisionMakers.length > 0) {
          const mappedLambdaMakers: DecisionMakerData[] = lambdaResult.decisionMakers.map((dm) => {
            const parsed = this.parseHonorific(dm.name);
            return {
              name: parsed.fullName,
              honorific: parsed.honorific,
              role: dm.role || 'Titular / Especialista',
              sourceUrl: dm.sourceUrl,
            };
          });
          decisionMakers = this.mergeDecisionMakers(decisionMakers, mappedLambdaMakers);
        }
        if (lambdaResult?.verifiedPlatforms) {
          verifiedPlatforms = Array.from(new Set([...verifiedPlatforms, ...lambdaResult.verifiedPlatforms]));
        }
      } catch (err: any) {
        this.logger.warn(`Lambda deep enrich fallback to local parsing: ${err.message}`);
      }
    }

    // TRUTH HIERARCHY RESOLUTION:
    const isManuallyProtected = Boolean(
      rawData.isManuallyVerified || lead.contacts.some((c) => c.isManuallyVerified),
    );

    const updates: Record<string, any> = {};

    // 1. Email validation and resolution
    const candidateEmail = parsedChannels.email;
    if (candidateEmail && (!lead.email || !isManuallyProtected)) {
      const emailValidation = await this.emailValidation.validateEmail(candidateEmail);
      if (emailValidation.status === EmailValidationResultStatus.VALID_DELIVERABLE) {
        updates.email = emailValidation.normalizedEmail || candidateEmail.trim().toLowerCase();
        updates.emailType = 'PRIMARY_BUSINESS';
        updates.emailDeliverability = EmailDeliverabilityStatus.VERIFIED;
        parsedChannels.email = updates.email;
      } else if (emailValidation.status === EmailValidationResultStatus.DOMAIN_NO_MX) {
        if (lead.email) {
          updates.emailDeliverability = EmailDeliverabilityStatus.INVALID_BOUNCE;
        }
      } else if (emailValidation.status === EmailValidationResultStatus.DNS_TEMPORARY_ERROR) {
        if (!lead.email) {
          updates.email = emailValidation.normalizedEmail || candidateEmail.trim().toLowerCase();
          updates.emailDeliverability = EmailDeliverabilityStatus.UNVERIFIED;
        }
      }
    }

    // 2. Phone / WhatsApp resolution (mobile takes priority over landlines without discarding corporate info)
    if (parsedChannels.phone && (!lead.phone || !isManuallyProtected)) {
      const normalized = this.phoneNormalizer.normalize(parsedChannels.phone, lead.country || 'Mexico');
      const isNewMobile = normalized.phoneType === PhoneLineType.MOBILE;
      const isExistingMobile = lead.phoneType === PhoneLineType.MOBILE;

      // Promote to primary phone if we found a mobile, or if no phone was set yet
      if (!isExistingMobile || isNewMobile) {
        updates.phone = normalized.phoneE164 || parsedChannels.phone;
        updates.phoneE164 = normalized.phoneE164;
        updates.phoneType = normalized.phoneType;
      }
    }

    // 3. Website resolution
    if (parsedChannels.websiteUrl && !lead.websiteUrl) {
      updates.websiteUrl = parsedChannels.websiteUrl;
      updates.websiteHttpStatus = 200;
    }

    const suggestedAngle = this.buildCommercialAngle(
      lead.name,
      verifiedPlatforms,
      Boolean(lead.websiteUrl || parsedChannels.websiteUrl),
    );

    const deepIntelligence: DeepIntelligenceResult = {
      businessId: lead.id,
      enrichedAt: new Date().toISOString(),
      knowledgePanel: lambdaKnowledgePanel,
      servicesCatalog: lambdaServicesCatalog,
      foundChannels: parsedChannels,
      decisionMakers,
      digitalFootprint: {
        organicSnippet: searchResults[0]?.content?.slice(0, 300) || undefined,
        verifiedPlatforms,
        hasDigitalPresence: verifiedPlatforms.length > 0 || Boolean(lead.websiteUrl || parsedChannels.websiteUrl),
      },
      suggestedAngle,
    };

    // TRANSACTIONAL PERSISTENCE:
    // Writes lead updates, decision-maker contacts, and social profiles inside an atomic transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Update ProspectedBusiness
      await tx.prospectedBusiness.update({
        where: { id: lead.id },
        data: {
          ...updates,
          enrichmentStatus: 'ENRICHED',
          rawGoogleData: {
            ...rawData,
            deepIntelligence: deepIntelligence as any,
          },
        },
      });

      // 2. Upsert Decision Maker Contacts
      for (let i = 0; i < decisionMakers.length; i++) {
        const dm = decisionMakers[i];
        await tx.prospectedBusinessContact.upsert({
          where: {
            uq_business_contact_name: {
              businessId: lead.id,
              fullName: dm.name,
            },
          },
          create: {
            tenantId: lead.tenantId,
            businessId: lead.id,
            fullName: dm.name,
            honorific: dm.honorific,
            titleRole: dm.role || 'Titular / Especialista',
            email: dm.email,
            phone: dm.phone,
            isPrimary: i === 0,
            confidence: 0.85,
            sourceUrl: dm.sourceUrl,
            sourceProvenance: 'ENRICHMENT_LAMBDA',
          },
          update: {
            honorific: dm.honorific,
            titleRole: dm.role || 'Titular / Especialista',
            sourceUrl: dm.sourceUrl,
            updatedAt: new Date(),
          },
        });
      }

      // 3. Upsert Social Profiles
      const socialsToSync: Array<{ platform: string; url: string; username?: string }> = [];
      if (parsedChannels.facebookUrl) {
        socialsToSync.push({
          platform: 'FACEBOOK',
          url: parsedChannels.facebookUrl,
          username: this.extractUsername(parsedChannels.facebookUrl),
        });
      }
      if (parsedChannels.instagramUrl) {
        socialsToSync.push({
          platform: 'INSTAGRAM',
          url: parsedChannels.instagramUrl,
          username: this.extractUsername(parsedChannels.instagramUrl),
        });
      }
      if (parsedChannels.linkedinUrl) {
        socialsToSync.push({
          platform: 'LINKEDIN',
          url: parsedChannels.linkedinUrl,
          username: this.extractUsername(parsedChannels.linkedinUrl),
        });
      }
      if (parsedChannels.whatsappUrl) {
        socialsToSync.push({
          platform: 'WHATSAPP',
          url: parsedChannels.whatsappUrl,
        });
      }

      for (const social of socialsToSync) {
        await tx.prospectedBusinessSocial.upsert({
          where: {
            uq_business_social_platform: {
              businessId: lead.id,
              platform: social.platform,
            },
          },
          create: {
            tenantId: lead.tenantId,
            businessId: lead.id,
            platform: social.platform,
            url: social.url,
            username: social.username,
            isVerified: true,
            sourceProvenance: 'ENRICHMENT_LAMBDA',
          },
          update: {
            url: social.url,
            username: social.username,
            updatedAt: new Date(),
          },
        });
      }
    });

    return deepIntelligence;
  }

  private extractContactChannels(
    results: Array<{ url: string; content: string }>,
    country: string,
  ): DeepIntelligenceResult['foundChannels'] {
    const channels: DeepIntelligenceResult['foundChannels'] = {};

    for (const r of results) {
      const urlLower = (r.url || '').toLowerCase();
      const content = r.content || '';

      if (urlLower.includes('facebook.com') && !channels.facebookUrl) {
        channels.facebookUrl = r.url;
      }
      if (urlLower.includes('instagram.com') && !channels.instagramUrl) {
        channels.instagramUrl = r.url;
      }
      if (urlLower.includes('linkedin.com') && !channels.linkedinUrl) {
        channels.linkedinUrl = r.url;
      }
      if (
        !channels.websiteUrl &&
        !urlLower.includes('facebook') &&
        !urlLower.includes('instagram') &&
        !urlLower.includes('google') &&
        !urlLower.includes('doctoralia') &&
        !urlLower.includes('yelp') &&
        !urlLower.includes('tripadvisor')
      ) {
        channels.websiteUrl = r.url;
      }

      // Mailto and regex email detection
      if (!channels.email) {
        const mailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
        if (mailMatch && !mailMatch[0].includes('wixpress') && !mailMatch[0].includes('sentry.io')) {
          channels.email = mailMatch[0].toLowerCase();
        }
      }

      // Regex phone detection
      if (!channels.phone) {
        const phoneMatch = content.match(/(?:\+?52|\+?57|\+?1)?[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
        if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) {
          const rawFound = phoneMatch[0].trim();
          const norm = this.phoneNormalizer.normalize(rawFound, country);
          channels.phone = norm.phoneE164 || rawFound;
          channels.phoneType = norm.phoneType;
          if (norm.phoneType === PhoneLineType.MOBILE && norm.whatsappDigits) {
            channels.whatsappUrl = `https://wa.me/${norm.whatsappDigits}`;
          }
        }
      }
    }

    return channels;
  }

  private extractDecisionMakers(
    results: Array<{ url: string; content: string; title?: string }>,
  ): DecisionMakerData[] {
    const makers: DecisionMakerData[] = [];
    const keywords = ['Dr.', 'Dra.', 'Doctor', 'Doctora', 'Director', 'Directora', 'Gerente', 'Fundador', 'Lic.', 'Ing.'];

    for (const r of results) {
      const text = `${r.title || ''} ${r.content || ''}`;
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,2})`, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const rawName = match[1].trim();
          const parsed = this.parseHonorific(`${kw} ${rawName}`);
          if (!makers.some((m) => m.name === parsed.fullName) && parsed.fullName.length < 50) {
            makers.push({
              name: parsed.fullName,
              honorific: parsed.honorific,
              role: kw.toLowerCase().startsWith('dr') ? 'Titular / Especialista' : 'Dirección / Gerencia',
              sourceUrl: r.url,
            });
          }
          if (makers.length >= 3) break;
        }
      }
    }

    return makers;
  }

  private parseHonorific(rawName: string): { fullName: string; honorific?: string } {
    const honorifics = ['Dr.', 'Dra.', 'Doctor', 'Doctora', 'Lic.', 'Ing.', 'Director', 'Directora', 'Mtro.', 'Mtra.'];
    for (const h of honorifics) {
      if (rawName.startsWith(`${h} `)) {
        return {
          honorific: h,
          fullName: rawName.replace(`${h} `, '').trim(),
        };
      }
    }
    return { fullName: rawName.trim() };
  }

  private mergeDecisionMakers(existing: DecisionMakerData[], incoming: DecisionMakerData[]): DecisionMakerData[] {
    const merged = [...existing];
    for (const inc of incoming) {
      if (!merged.some((m) => m.name.toLowerCase() === inc.name.toLowerCase())) {
        merged.push(inc);
      }
    }
    return merged.slice(0, 3);
  }

  private extractUsername(url: string): string | undefined {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || undefined;
    } catch {
      return undefined;
    }
  }

  private detectPlatforms(results: Array<{ url: string }>): string[] {
    const platforms: string[] = [];
    for (const r of results) {
      const u = (r.url || '').toLowerCase();
      if (u.includes('facebook.com') && !platforms.includes('Facebook')) platforms.push('Facebook');
      if (u.includes('instagram.com') && !platforms.includes('Instagram')) platforms.push('Instagram');
      if (u.includes('doctoralia') && !platforms.includes('Doctoralia')) platforms.push('Doctoralia');
      if (u.includes('linkedin.com') && !platforms.includes('LinkedIn')) platforms.push('LinkedIn');
      if (u.includes('paginasamarillas') && !platforms.includes('Páginas Amarillas')) platforms.push('Páginas Amarillas');
    }
    return platforms;
  }

  private buildCommercialAngle(name: string, platforms: string[], hasWebsite: boolean): string {
    if (!hasWebsite && platforms.includes('Facebook')) {
      return `Negocio activo en redes sociales pero sin activo web propio: riesgo crítico de dependencia de plataforma. Enfoque: 'Web de conversión directa para dejar de pagar ads a ciegas'.`;
    }
    if (!hasWebsite && platforms.length === 0) {
      return `Presencia digital nula fuera de Maps: están perdiendo el 100% de pacientes/clientes que buscan en Google orgánico. Enfoque: 'Pack de lanzamiento digital con WhatsApp integrado'.`;
    }
    return `Presencia omnicanal detectada en ${platforms.join(', ')}. Enfoque: 'Unificación de agenda digital y aceleración de conversión móvil'.`;
  }
}
