import { Controller, Get, Put, Post, Delete, Body, Param, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  TenantsService, 
  UpdatePositioningDto, 
  CreateProofStoryDto, 
  UpdateScrapeConfigDto, 
  SaveCredentialDto,
  FullProfileSyncDto,
  CreateProfileDto,
} from './tenants.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { CvTailorService, PublicationsCvDocument, BaseCvData } from '../proposals/cv-tailor.service';

@Controller('api/config')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
    private readonly cvTailor: CvTailorService,
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

  @Get('market-taxonomy')
  async getMarketTaxonomy() {
    return this.tenantsService.getMarketTaxonomy();
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
   * POST /api/config/profiles
   * Crea un perfil vacío directamente en PostgreSQL y lo deja activo.
   */
  @Post('profiles')
  async createProfile(@Body() body: CreateProfileDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.createBlankProfile(tenantId, body);
  }

  /**
   * DELETE /api/config/profiles/:id
   * Elimina un perfil almacenado en PostgreSQL.
   */
  @Delete('profiles/:id')
  async deleteProfile(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.deleteProfile(tenantId, id);
  }

  /**
   * POST /api/config/activate-profile
   * Activa un perfil existente por su ID dentro del tenant actual
   */
  @Post('activate-profile')
  async activateProfile(@Body() body: { profileId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.activateProfile(tenantId, body.profileId);
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

  /**
   * POST /api/config/synthesize-profile-from-cv
   * Sintetiza el perfil completo, taxonomía 4 capas, queries de Upwork y rationale de scoring
   * a partir de texto plano o archivo subido (.pdf, .txt, .md).
   */
  @Post('synthesize-profile-from-cv')
  @UseInterceptors(FileInterceptor('file'))
  async synthesizeProfileFromCv(
    @Body('rawText') rawText?: string,
    @UploadedFile() file?: any,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.synthesizeProfileFromCv(tenantId, rawText, file);
  }

  /**
   * GET /api/config/profiles/:id/cv
   * Obtiene el CV maestro en formato Publications ATS del perfil especificado.
   */
  @Get('profiles/:id/cv')
  async getProfileCv(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.getProfileCv(tenantId, id);
  }

  /**
   * PUT /api/config/profiles/:id/cv
   * Guarda o actualiza el CV maestro en formato Publications ATS en PostgreSQL.
   */
  @Put('profiles/:id/cv')
  async updateProfileCv(
    @Param('id') id: string,
    @Body('baseCv') baseCv: PublicationsCvDocument,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.updateProfileCv(tenantId, id, baseCv);
  }

  /**
   * POST /api/config/cv/parse-and-save
   * Recibe un CV (en PDF o texto plano), lo procesa con IA generando ambas versiones (ES/EN)
   * y lo guarda en PostgreSQL bajo el esquema exacto de Publications (ats-cv).
   */
  @Post('cv/parse-and-save')
  @UseInterceptors(FileInterceptor('file'))
  async parseAndSaveCv(
    @Body('profileId') profileId?: string,
    @Body('rawText') rawText?: string,
    @UploadedFile() file?: any,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantsService.parseAndSaveCv(tenantId, profileId, rawText, file);
  }

  /**
   * POST /api/config/cv/preview-pdf
   * Renderiza el CV en PDF con Gotenberg para previsualización inmediata.
   */
  @Post('cv/preview-pdf')
  async previewPdf(
    @Body() body: { baseCv: BaseCvData; customCss?: string },
    @Res() res: Response,
  ) {
    const html = this.cvTailor.buildCvHtml(body.baseCv);
    const pdfBuffer = await this.cvTailor.renderPdfViaGotenberg(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cv_preview.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  }
}
