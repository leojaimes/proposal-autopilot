import { Controller, Post, Get, Patch, Body, Param, Query, Logger } from '@nestjs/common';
import { ProspectingService } from './prospecting.service';
import { GeocodeCityDto } from './dto/geocode-city.dto';
import { ScanAreaDto } from './dto/scan-area.dto';
import { CompanyPainCategory, ProspectedLeadStatus } from '@prisma/client';

@Controller('api/prospecting')
export class ProspectingController {
  private readonly logger = new Logger(ProspectingController.name);

  constructor(private readonly prospectingService: ProspectingService) {}

  @Post('geocode-city')
  async geocodeCity(@Body() dto: GeocodeCityDto) {
    return this.prospectingService.geocodeCity(dto.city, dto.state, dto.country);
  }

  @Post('scan-area')
  async scanArea(@Body() dto: ScanAreaDto) {
    return this.prospectingService.scanArea(dto);
  }

  @Get('leads')
  async getLeads(
    @Query('city') city?: string,
    @Query('pain') pain?: CompanyPainCategory,
    @Query('status') status?: ProspectedLeadStatus,
  ) {
    return this.prospectingService.getLeads({ city, primaryPain: pain, status });
  }

  @Patch('leads/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ProspectedLeadStatus,
  ) {
    return this.prospectingService.updateLeadStatus(id, status);
  }
}

