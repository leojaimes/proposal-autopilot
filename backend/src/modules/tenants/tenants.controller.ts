import { Controller, Get, Put, Post, Delete, Body, Param } from '@nestjs/common';
import { 
  TenantsService, 
  UpdatePositioningDto, 
  CreateProofStoryDto, 
  UpdateScrapeConfigDto, 
  SaveCredentialDto,
  FullProfileSyncDto 
} from './tenants.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Controller('api/config')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * GET /api/config/workspace
   * Retorna toda la configuración actual (Oferta, Audiencia, Historias, Filtros, Credenciales)
   */
  @Get('workspace')
  async getWorkspace() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.getTenantConfig(tenantId);
  }

  /**
   * PUT /api/config/full-profile
   * Sincroniza atómicamente el perfil completo (Oferta, Audiencia, Taxonomía, Queries, Filtros y Proof Stories)
   */
  @Put('full-profile')
  async syncFullProfile(@Body() body: FullProfileSyncDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.syncFullProfile(tenantId, body);
  }

  /**
   * PUT /api/config/positioning
   * Actualiza el posicionamiento (Offer Headline, Target Audience, Voice Rules)
   */
  @Put('positioning')
  async updatePositioning(@Body() body: UpdatePositioningDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.updatePositioning(tenantId, body);
  }

  /**
   * POST /api/config/proof-stories
   * Agrega una nueva historia de prueba con sus métricas
   */
  @Post('proof-stories')
  async createProofStory(@Body() body: CreateProofStoryDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.createProofStory(tenantId, body);
  }

  /**
   * PUT /api/config/proof-stories/:id
   * Modifica una historia de prueba existente
   */
  @Put('proof-stories/:id')
  async updateProofStory(@Param('id') id: string, @Body() body: Partial<CreateProofStoryDto>) {
    return this.tenantsService.updateProofStory(id, body);
  }

  /**
   * DELETE /api/config/proof-stories/:id
   * Elimina una historia de prueba
   */
  @Delete('proof-stories/:id')
  async deleteProofStory(@Param('id') id: string) {
    return this.tenantsService.deleteProofStory(id);
  }

  /**
   * PUT /api/config/scrape
   * Actualiza las palabras clave, presupuesto mínimo, antigüedad y filtros de Upwork
   */
  @Put('scrape')
  async updateScrapeConfig(@Body() body: UpdateScrapeConfigDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.updateScrapeConfig(tenantId, body);
  }

  /**
   * POST /api/config/credentials
   * Guarda o actualiza credenciales de Apify, Anthropic, OpenAI, Bedrock o Gemini
   */
  @Post('credentials')
  async saveCredential(@Body() body: SaveCredentialDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.saveCredential(tenantId, body);
  }

  /**
   * POST /api/config/synthesize-queries
   * Sintetiza queries booleanas dinámicas a partir de las Proof Stories y la Oferta usando Gemini
   */
  @Post('synthesize-queries')
  async synthesizeQueries() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.synthesizeSearchQueries(tenantId);
  }

  /**
   * POST /api/config/synthesize-taxonomy
   * Sintetiza la taxonomía de 4 capas de afinidad (Core, Hybrid, Tangential, Excluded) usando Gemini
   */
  @Post('synthesize-taxonomy')
  async synthesizeTaxonomy() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.synthesizeTaxonomy(tenantId);
  }
}
