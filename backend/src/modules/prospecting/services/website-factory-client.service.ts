import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { createHmac } from 'node:crypto';
import { WebsiteDemoReadyWebhookDto } from '../dto/prospecting-webhook.dto';

@Injectable()
export class WebsiteFactoryClientService {
  private readonly logger = new Logger(WebsiteFactoryClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Maps local business category to publications vertical taxonomies
   */
  public mapCategoryToVertical(category?: string | null): string {
    if (!category) return 'general';
    const c = category.toLowerCase();
    if (c.includes('dent') || c.includes('odont') || c.includes('ortodon')) return 'dentist';
    if (c.includes('restauran') || c.includes('comida') || c.includes('tacos') || c.includes('bar') || c.includes('grill') || c.includes('cafeter') || c.includes('bistro')) return 'restaurant';
    if (c.includes('gimnas') || c.includes('gym') || c.includes('crossfit') || c.includes('fitness')) return 'gym';
    if (c.includes('clinic') || c.includes('medic') || c.includes('doctor') || c.includes('salud') || c.includes('hospital')) return 'clinic';
    if (c.includes('spa') || c.includes('estetic') || c.includes('salon') || c.includes('belleza') || c.includes('barber')) return 'beauty_salon';
    if (c.includes('abog') || c.includes('legal') || c.includes('notar') || c.includes('jurid')) return 'legal';
    if (c.includes('inmobil') || c.includes('real estate') || c.includes('propiedad') || c.includes('bienes raic')) return 'real_estate';
    if (c.includes('cafe') || c.includes('coffee')) return 'coffee_shop';
    if (c.includes('mecanic') || c.includes('auto') || c.includes('taller') || c.includes('llantas')) return 'automobile';
    if (c.includes('veterin') || c.includes('mascot') || c.includes('pet')) return 'pet_care';
    if (c.includes('arquit') || c.includes('construc') || c.includes('diseño')) return 'architecture';
    if (c.includes('agenc') || c.includes('market') || c.includes('publicid')) return 'agency';
    return 'general';
  }

  /**
   * Dispatches an interactive demo generation request to Publications Website Factory via M2M HMAC
   */
  public async generateDemoForLead(leadId: string): Promise<any> {
    const lead = await this.prisma.prospectedBusiness.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found`);
    }

    const factoryUrl =
      this.configService.get<string>('PUBLICATIONS_FACTORY_URL') ||
      process.env.PUBLICATIONS_FACTORY_URL ||
      'http://host.docker.internal:3007';

    const secret =
      this.configService.get<string>('LAMBDA_WEBHOOK_SECRET') ||
      process.env.LAMBDA_WEBHOOK_SECRET ||
      'spotlight_visual_scraper_secret_2026';

    const vertical = this.mapCategoryToVertical(lead.category);

    const painAnalysis = (lead.painAnalysis as Record<string, any>) || {};
    const address = [lead.address, lead.city, lead.state, lead.country]
      .filter(Boolean)
      .join(', ');

    const payload: Record<string, any> = {
      businessName: lead.name,
      vertical,
      externalTenantId: lead.tenantId,
      leadId: lead.id,
      originSystem: 'proposal-autopilot',
      phone: lead.phone || undefined,
      email: lead.email || undefined,
      address: address || undefined,
      callbackUrl:
        process.env.PROPOSAL_AUTOPILOT_CALLBACK_URL ||
        'http://localhost:7000/api/prospecting/webhooks/demo-ready',
    };

    if (
      lead.websiteUrl &&
      (lead.websiteUrl.startsWith('http://') || lead.websiteUrl.startsWith('https://'))
    ) {
      payload.websiteUrl = lead.websiteUrl;
    }

    const bodyString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${bodyString}`)
      .digest('hex');

    this.logger.log(
      `[WebsiteFactoryClient] Requesting demo for lead "${lead.name}" (${lead.id}) at ${factoryUrl}...`,
    );

    const targetEndpoint = `${factoryUrl.replace(/\/+$/, '')}/api/v1/factory/demos`;

    try {
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp,
          'x-origin-system': 'proposal-autopilot',
        },
        body: bodyString,
        signal: AbortSignal.timeout(35_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Factory HTTP ${response.status}: ${errorText}`);
      }

      const resData = (await response.json()) as any;

      const websiteDemo = {
        slug: resData.slug,
        demoUrl: resData.preview?.publicUrl,
        screenshotUrl: resData.preview?.screenshotUrl,
        status: resData.status || 'ready',
        generatedAt: new Date().toISOString(),
      };

      // Persist in lead's painAnalysis
      const updatedPainAnalysis = {
        ...painAnalysis,
        websiteDemo,
      };

      await this.prisma.prospectedBusiness.update({
        where: { id: lead.id },
        data: {
          painAnalysis: updatedPainAnalysis,
        },
      });

      this.logger.log(
        `[WebsiteFactoryClient] Demo successfully created & persisted for "${lead.name}": ${websiteDemo.demoUrl}`,
      );

      return websiteDemo;
    } catch (err: any) {
      this.logger.error(
        `[WebsiteFactoryClient] Failed to generate demo for lead ${lead.id}: ${err?.message || err}`,
      );
      throw err;
    }
  }

  /**
   * Processes the asynchronous callback webhook from publications when the demo is ready
   */
  public async handleDemoReadyWebhook(payload: WebsiteDemoReadyWebhookDto): Promise<any> {
    const lead = await this.prisma.prospectedBusiness.findUnique({
      where: { id: payload.leadId },
    });

    if (!lead) {
      this.logger.warn(
        `[WebsiteFactoryClient] Received demo-ready webhook for unknown lead: ${payload.leadId}`,
      );
      return { received: false, error: 'Lead not found' };
    }

    const currentPainAnalysis = (lead.painAnalysis as Record<string, any>) || {};
    const websiteDemo = {
      slug: payload.slug,
      demoUrl: payload.demoUrl,
      screenshotUrl: payload.screenshotUrl,
      status: 'ready',
      generatedAt: new Date().toISOString(),
    };

    await this.prisma.prospectedBusiness.update({
      where: { id: payload.leadId },
      data: {
        painAnalysis: {
          ...currentPainAnalysis,
          websiteDemo,
        },
      },
    });

    this.logger.log(
      `[WebsiteFactoryClient] Lead ${payload.leadId} updated via demo-ready webhook (Demo: ${payload.demoUrl})`,
    );

    return { received: true, leadId: payload.leadId, demo: websiteDemo };
  }
}

