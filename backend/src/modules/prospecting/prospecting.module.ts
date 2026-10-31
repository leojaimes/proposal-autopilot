import { Module } from '@nestjs/common';
import { ProspectingController } from './prospecting.controller';
import { ProspectingService } from './prospecting.service';
import { NominatimGeocodingService } from './services/nominatim-geocoding.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { LambdaGoogleProspectingService } from './services/lambda-google-prospecting.service';
import { PhoneNormalizerService } from './services/phone-normalizer.service';
import { ChainDetectorService } from './services/chain-detector.service';
import { WebsiteHealthInspectorService } from './services/website-health-inspector.service';
import { ProspectEnrichmentQueueService } from './services/prospect-enrichment-queue.service';
import { ContactCooldownPolicyService } from './services/contact-cooldown.service';
import { HmacWebhookGuard } from './guards/hmac-webhook.guard';
import { AdminRoleGuard } from '../../core/guards/admin-role.guard';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Module({
  controllers: [ProspectingController],
  providers: [
    ProspectingService,
    NominatimGeocodingService,
    CompanyPainAnalyzerService,
    LambdaGoogleProspectingService,
    PhoneNormalizerService,
    ChainDetectorService,
    WebsiteHealthInspectorService,
    ProspectEnrichmentQueueService,
    ContactCooldownPolicyService,
    HmacWebhookGuard,
    AdminRoleGuard,
    PrismaService,
    TenantContextService,
  ],
  exports: [
    ProspectingService,
    NominatimGeocodingService,
    CompanyPainAnalyzerService,
    LambdaGoogleProspectingService,
    PhoneNormalizerService,
    ChainDetectorService,
    WebsiteHealthInspectorService,
    ProspectEnrichmentQueueService,
    ContactCooldownPolicyService,
  ],
})
export class ProspectingModule {}
