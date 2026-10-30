import { Module } from '@nestjs/common';
import { ProspectingController } from './prospecting.controller';
import { ProspectingService } from './prospecting.service';
import { NominatimGeocodingService } from './services/nominatim-geocoding.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Module({
  controllers: [ProspectingController],
  providers: [
    ProspectingService,
    NominatimGeocodingService,
    CompanyPainAnalyzerService,
    PrismaService,
    TenantContextService,
  ],
  exports: [ProspectingService, NominatimGeocodingService, CompanyPainAnalyzerService],
})
export class ProspectingModule {}

