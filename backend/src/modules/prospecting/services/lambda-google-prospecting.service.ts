import { Injectable, Logger } from '@nestjs/common';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export interface LambdaGoogleScrapeOptions {
  query: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  polygon?: Array<{ lat: number; lng: number }>;
  location?: string;
  limit?: number;
  proxyServer?: string;
}

@Injectable()
export class LambdaGoogleProspectingService {
  private readonly logger = new Logger(LambdaGoogleProspectingService.name);
  private readonly lambdaClient: LambdaClient;
  private readonly functionName: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.functionName = process.env.AWS_LAMBDA_SCRAPER_FUNCTION_NAME || 'spotlight-visual-scraper-dev';

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    this.lambdaClient = new LambdaClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    });
  }

  /**
   * Invoca la AWS Lambda para extraer negocios reales de Google Maps
   * filtrando por radio circular o polígono táctico Geoman.
   */
  async scrapeGoogleBusinesses(options: LambdaGoogleScrapeOptions): Promise<any[]> {
    const {
      query,
      center,
      radiusKm = 5,
      polygon,
      location,
      limit = 20,
      proxyServer,
    } = options;

    const payload = {
      action: 'SCRAPE_GOOGLE_BUSINESSES',
      query,
      center,
      radiusKm,
      polygon,
      location,
      limit,
      proxyServer: proxyServer || process.env.SCRAPER_RESIDENTIAL_PROXY,
    };

    this.logger.log(`Invocando Lambda "${this.functionName}" para Google Businesses: "${query}" en [${center?.lat}, ${center?.lng}]`);

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    try {
      const response = await this.lambdaClient.send(command);

      if (response.FunctionError) {
        throw new Error(`Lambda execution error: ${response.FunctionError}`);
      }

      const responseString = Buffer.from(response.Payload || []).toString('utf-8');
      const parsed = JSON.parse(responseString);

      const body = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed;
      const businesses = Array.isArray(body?.businesses) ? body.businesses : [];

      this.logger.log(`Lambda Google scraper exitoso: ${businesses.length} prospectos extraídos y analizados.`);
      return businesses;
    } catch (error: any) {
      this.logger.error(`Error invocando Lambda Google scraper: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Invoca la AWS Lambda para realizar enriquecimiento profundo de contacto y tomadores de decisión
   * mediante arquitectura en cascada (Fast-Path HTTP + Slow-Path Chromium Stealth).
   */
  async deepEnrichBusiness(options: {
    businessName: string;
    urls: string[];
    country?: string;
  }): Promise<{
    channels: {
      whatsappUrl?: string;
      phone?: string;
      phoneE164?: string;
      phoneType?: 'MOBILE' | 'LANDLINE' | 'TOLL_FREE';
      email?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      linkedinUrl?: string;
      websiteUrl?: string;
    };
    decisionMakers: Array<{ name: string; role?: string; sourceUrl?: string }>;
    verifiedPlatforms: string[];
    fastPathSuccess: boolean;
    slowPathTriggered: boolean;
  }> {
    const { businessName, urls, country = 'Mexico' } = options;

    const payload = {
      action: 'DEEP_ENRICH_BUSINESS',
      businessName,
      urls,
      country,
      proxyServer: process.env.SCRAPER_RESIDENTIAL_PROXY,
    };

    this.logger.log(`Invocando Lambda "${this.functionName}" para DEEP_ENRICH_BUSINESS en ${businessName} (${urls.length} URLs)`);

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    try {
      const response = await this.lambdaClient.send(command);

      if (response.FunctionError) {
        throw new Error(`Lambda deep enrich error: ${response.FunctionError}`);
      }

      const responseString = Buffer.from(response.Payload || []).toString('utf-8');
      const parsed = JSON.parse(responseString);
      const body = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed;

      return {
        channels: body?.channels || {},
        decisionMakers: body?.decisionMakers || [],
        verifiedPlatforms: body?.verifiedPlatforms || [],
        fastPathSuccess: Boolean(body?.fastPathSuccess),
        slowPathTriggered: Boolean(body?.slowPathTriggered),
      };
    } catch (error: any) {
      this.logger.error(`Error invocando Lambda deep enrich: ${error.message}`, error.stack);
      throw error;
    }
  }
}

