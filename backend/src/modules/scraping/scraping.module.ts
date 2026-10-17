import { Module } from '@nestjs/common';
import { ApifyService } from './apify.service';
import { ScrapingController } from './scraping.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Module({
  imports: [ScoringModule, ProposalsModule],
  controllers: [ScrapingController],
  providers: [ApifyService, PrismaService, TenantContextService],
  exports: [ApifyService],
})
export class ScrapingModule {}
