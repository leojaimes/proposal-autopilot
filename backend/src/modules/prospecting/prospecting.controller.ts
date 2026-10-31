import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProspectingService } from './prospecting.service';
import { GeocodeCityDto } from './dto/geocode-city.dto';
import { ScanAreaDto } from './dto/scan-area.dto';
import { ProspectingWebhookPayloadDto } from './dto/prospecting-webhook.dto';
import {
  BlacklistLeadDto,
  CreateContactLogDto,
  EmailWebhookEventDto,
  GetLeadsQueryDto,
  UpdateBusinessPainStatusDto,
  UpdateLeadStatusDto,
  UpsertPainCatalogDto,
} from './dto/prospecting-enterprise.dto';
import { HmacWebhookGuard, WebhookSource } from './guards/hmac-webhook.guard';
import { AdminRoleGuard } from '../../core/guards/admin-role.guard';

@Controller('api/prospecting')
export class ProspectingController {
  constructor(private readonly prospectingService: ProspectingService) {}

  @Post('webhook/progress')
  @UseGuards(HmacWebhookGuard)
  @WebhookSource('LAMBDA')
  @HttpCode(HttpStatus.OK)
  async handleWebhookProgress(@Body() payload: ProspectingWebhookPayloadDto) {
    return this.prospectingService.handleWebhookPayload(payload);
  }

  @Post('webhooks/email')
  @UseGuards(HmacWebhookGuard)
  @WebhookSource('EMAIL')
  @HttpCode(HttpStatus.OK)
  async handleEmailTelemetryWebhook(@Body() payload: EmailWebhookEventDto) {
    return this.prospectingService.handleEmailWebhook(payload);
  }

  @Post('geocode-city')
  async geocodeCity(@Body() dto: GeocodeCityDto) {
    return this.prospectingService.geocodeCity(dto.city, dto.state, dto.country);
  }

  @Get('geo-presets')
  async getGeoPresets(@Query('country') country?: string) {
    return this.prospectingService.getGeoPresets(country);
  }

  @Get('pains')
  async getPainCatalog(@Query('includeInactive') includeInactive?: string) {
    return this.prospectingService.getPainCatalog(includeInactive === 'true');
  }

  @Post('pains')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  async upsertPainCatalog(@Body() dto: UpsertPainCatalogDto) {
    return this.prospectingService.upsertPainCatalog(dto);
  }

  @Post('scan-area')
  async scanArea(@Body() dto: ScanAreaDto) {
    return this.prospectingService.scanArea(dto);
  }

  @Get('leads')
  async getLeads(@Query() query: GetLeadsQueryDto) {
    return this.prospectingService.getLeads(query);
  }

  @Patch('leads/:id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.prospectingService.updateLeadStatus(id, dto.status);
  }

  @Get('leads/:id/pains')
  async getBusinessPains(@Param('id', ParseUUIDPipe) id: string) {
    return this.prospectingService.getBusinessPains(id);
  }

  @Patch('leads/:id/pains/:painId/status')
  async updateBusinessPainStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('painId') painId: string,
    @Body() dto: UpdateBusinessPainStatusDto,
  ) {
    return this.prospectingService.updateBusinessPainStatus(id, painId, dto);
  }

  @Get('leads/:id/contacts')
  async getBusinessContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.prospectingService.getBusinessContacts(id);
  }

  @Post('leads/:id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async createBusinessContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactLogDto,
  ) {
    return this.prospectingService.recordBusinessContact(id, dto);
  }

  @Post('leads/:id/blacklist')
  @HttpCode(HttpStatus.OK)
  async blacklistBusiness(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlacklistLeadDto,
  ) {
    return this.prospectingService.blacklistBusiness(id, dto.reason);
  }

  @Get('brands')
  async getCorporateBrands(@Query('onlyTenantBranches') onlyTenantBranches?: string) {
    return this.prospectingService.getCorporateBrands(onlyTenantBranches === 'true');
  }

  @Get('brands/:id/branches')
  async getCorporateBrandBranches(@Param('id', ParseUUIDPipe) id: string) {
    return this.prospectingService.getCorporateBrandBranches(id);
  }

  @Get('analytics/funnel')
  async getProspectingFunnelAnalytics() {
    return this.prospectingService.getProspectingFunnelAnalytics();
  }
}
