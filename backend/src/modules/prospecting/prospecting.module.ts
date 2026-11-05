import { Module } from '@nestjs/common';
import { ProspectingController } from './prospecting.controller';
import { ProspectingService } from './prospecting.service';
import { NominatimGeocodingService } from './services/nominatim-geocoding.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { LambdaGoogleProspectingService } from './services/lambda-google-prospecting.service';
import { GooglePlacesOfficialService } from './services/google-places.service';
import { PhoneNormalizerService } from './services/phone-normalizer.service';
import { ChainDetectorService } from './services/chain-detector.service';
import { WebsiteHealthInspectorService } from './services/website-health-inspector.service';
import { ProspectEnrichmentQueueService } from './services/prospect-enrichment-queue.service';
import { ContactCooldownPolicyService } from './services/contact-cooldown.service';
import { ProspectingStreamService } from './services/prospecting-stream.service';
import { OrionDeepProspectEnricherService } from './services/orion-deep-prospect-enricher.service';
import { EmailValidationService } from './services/email-validation.service';
import { WebsiteFactoryClientService } from './services/website-factory-client.service';
import { OrionSearchService } from '../scraping/services/orion-search.service';
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
    GooglePlacesOfficialService,
    PhoneNormalizerService,
    ChainDetectorService,
    WebsiteHealthInspectorService,
    ProspectEnrichmentQueueService,
    ContactCooldownPolicyService,
    ProspectingStreamService,
    OrionDeepProspectEnricherService,
    EmailValidationService,
    WebsiteFactoryClientService,
    OrionSearchService,
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
    GooglePlacesOfficialService,
    PhoneNormalizerService,
    ChainDetectorService,
    WebsiteHealthInspectorService,
    ProspectEnrichmentQueueService,
    ContactCooldownPolicyService,
    ProspectingStreamService,
    OrionDeepProspectEnricherService,
    EmailValidationService,
    WebsiteFactoryClientService,
  ],
})
export class ProspectingModule {}
