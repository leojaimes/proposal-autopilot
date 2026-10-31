import { Injectable, Logger } from '@nestjs/common';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export interface LambdaUpworkScrapeOptions {
  keywords: string[];
  limit?: number;
  sort?: 'recency' | 'relevance';
  experienceLevel?: Array<'EntryLevel' | 'IntermediateLevel' | 'ExpertLevel'>;
  proxyServer?: string;
}

@Injectable()
export class LambdaUpworkScraperService {
  private readonly logger = new Logger(LambdaUpworkScraperService.name);
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
   * Invoca de forma nativa la AWS Lambda visual-scraper para extraer vacantes de Upwork
   * con datos enriquecidos (preguntas de postulación, solvencia, tier, presupuesto).
   */
  async scrapeJobs(options: LambdaUpworkScrapeOptions): Promise<Record<string, any>[]> {
    const {
      keywords,
      limit = 20,
      sort = 'recency',
      experienceLevel,
      proxyServer,
    } = options;

    const payload = {
      action: 'SCRAPE_UPWORK_JOBS',
      keywords,
      limit,
      sort,
      experienceLevel,
      proxyServer: proxyServer || process.env.SCRAPER_PROXY_URL,
    };

    this.logger.log(`Invocando Lambda "${this.functionName}" para Upwork: ${keywords.join(', ')} (Max: ${limit})`);

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
      const jobs = Array.isArray(body?.jobs) ? body.jobs : [];

      this.logger.log(`Lambda Upwork scraper exitoso: ${jobs.length} empleos extraídos.`);
      return jobs;
    } catch (error: any) {
      this.logger.error(`Error invocando Lambda Upwork scraper: ${error.message}`, error.stack);
      throw error;
    }
  }
}

