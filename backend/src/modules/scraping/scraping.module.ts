import { Module } from '@nestjs/common';
import { ApifyService } from './apify.service';
import { ScrapingController } from './scraping.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

import { ApifyJobAdapter } from './adapters/apify-job.adapter';
import { OfficialUpworkApiAdapter } from './adapters/official-upwork.adapter';
import { ScrapingProgressService } from './scraping-progress.service';
import { MarketTaxonomyAssignmentService } from './services/market-taxonomy-assignment.service';
import { MarketSnapshotService } from './services/market-snapshot.service';
import { MarketRadarOperationsService } from './services/market-radar-operations.service';
import { MarketRadarDecisionService } from './services/market-radar-decision.service';
import { TaxonomyClassificationEventsService } from './services/taxonomy-classification-events.service';
import { MarketRadarRebuildQueueService } from './services/market-radar-rebuild-queue.service';
import { TaxonomyClassificationWorkService } from './services/taxonomy-classification-work.service';

@Module({
  imports: [ScoringModule, ProposalsModule],
  controllers: [ScrapingController],
  providers: [
    ApifyService, 
    ScrapingProgressService,
    ApifyJobAdapter, 
    OfficialUpworkApiAdapter, 
    MarketTaxonomyAssignmentService,
    MarketSnapshotService,
    MarketRadarOperationsService,
    MarketRadarDecisionService,
    MarketRadarRebuildQueueService,
    TaxonomyClassificationWorkService,
    TaxonomyClassificationEventsService,
    PrismaService, 
    TenantContextService
  ],
  exports: [ApifyService, ScrapingProgressService, ApifyJobAdapter, OfficialUpworkApiAdapter],
})
export class ScrapingModule {}
