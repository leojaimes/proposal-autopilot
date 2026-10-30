import { Injectable, Logger } from '@nestjs/common';
import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';

export interface LambdaScrapeOptions {
  keywords: string[];
  limit?: number;
  location?: string;
  batchId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  proxyServer?: string;
  asyncMode?: boolean;
}

@Injectable()
export class LambdaLinkedInScraperService {
  private readonly logger = new Logger(LambdaLinkedInScraperService.name);
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
   * Invoca la AWS Lambda visual-scraper para extraer vacantes de LinkedIn usando Puppeteer Stealth.
   * Si asyncMode es true o se proporciona webhookUrl, puede invocarse como 'Event'.
   * Por defecto, se ejecuta como 'RequestResponse' sincrónico ultra-rápido (~3-8s).
   */
  async scrapeJobs(options: LambdaScrapeOptions): Promise<Record<string, any>[]> {
    const {
      keywords,
      limit = 15,
      location = 'United States',
      batchId,
      webhookUrl,
      webhookSecret = process.env.LAMBDA_WEBHOOK_SECRET || 'spotlight_visual_scraper_secret_2026',
      proxyServer = process.env.SCRAPER_RESIDENTIAL_PROXY,
      asyncMode = false,
    } = options;

    const payload = {
      action: 'SCRAPE_LINKEDIN_JOBS',
      keywords,
      limit,
      location,
      batchId,
      webhookUrl,
      webhookSecret,
      proxyServer,
    };

    const invocationType: InvocationType = asyncMode ? 'Event' : 'RequestResponse';
    const startTime = Date.now();

    this.logger.log(
      `[Lambda Scraper] Invocando ${this.functionName} (${invocationType}) para ${keywords.join(', ')} (limit: ${limit}, loc: ${location})`,
    );

    try {
      const response = await this.lambdaClient.send(
        new InvokeCommand({
          FunctionName: this.functionName,
          InvocationType: invocationType,
          Payload: Buffer.from(JSON.stringify(payload)),
        }),
      );

      const durationMs = Date.now() - startTime;

      if (asyncMode) {
        this.logger.log(`[Lambda Scraper] Petición asíncrona despachada con éxito en ${durationMs}ms`);
        return [];
      }

      if (!response.Payload) {
        this.logger.warn(`[Lambda Scraper] Respuesta vacía de Lambda ${this.functionName}`);
        return [];
      }

      const rawString = Buffer.from(response.Payload).toString('utf-8');
      const parsed = JSON.parse(rawString);

      // Si la Lambda retorna en formato API Gateway { statusCode, body }
      let resultData = parsed;
      if (typeof parsed.body === 'string') {
        try {
          resultData = JSON.parse(parsed.body);
        } catch {
          resultData = parsed;
        }
      }

      const jobs = Array.isArray(resultData.jobs) ? resultData.jobs : [];
      this.logger.log(
        `[Lambda Scraper] Completado en ${(durationMs / 1000).toFixed(2)}s. Vacantes extraídas: ${jobs.length} (totalFound: ${resultData.totalFound || jobs.length})`,
      );

      return jobs;
    } catch (error: any) {
      this.logger.error(
        `[Lambda Scraper] Error al invocar la Lambda ${this.functionName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

