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

@Module({
  imports: [ScoringModule, ProposalsModule],
  controllers: [ScrapingController],
  providers: [
    ApifyService, 
    ScrapingProgressService,
    ApifyJobAdapter, 
    OfficialUpworkApiAdapter, 
    PrismaService, 
    TenantContextService
  ],
  exports: [ApifyService, ScrapingProgressService, ApifyJobAdapter, OfficialUpworkApiAdapter],
})
export class ScrapingModule {}
