import { Injectable, Logger } from '@nestjs/common';
import { ApifyClient } from 'apify-client';
import { RawApifyUpworkJob } from './dto/raw-job.dto';

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);
  private client: ApifyClient;

  constructor() {
    const token = process.env.APIFY_TOKEN;
    if (!token || token.includes('REPLACE_WITH_YOUR')) {
      this.logger.warn('APIFY_TOKEN no está configurado en .env. Las corridas de scraping usarán mock o fallarán.');
    }
    this.client = new ApifyClient({ token });
  }

  /**
   * Ejecuta el actor de extracción de trabajos de Upwork (flash_mage/upwork)
   */
  async runUpworkScraper(
    keywords: string[],
    maxResults: number = 30,
    options?: {
      experienceLevel?: string[];
      sort?: string;
    }
  ): Promise<RawApifyUpworkJob[]> {
    try {
      this.logger.log(`Iniciando scraping en Apify con ${keywords.length} queries: ${keywords.join(' | ')} | Max: ${maxResults}`);

      // Actor probado y verificado: flash_mage/upwork con orden Newest y nivel Experto/Intermedio
      const run = await this.client.actor('flash_mage/upwork').call({
        queries: keywords,
        limit: maxResults,
        sort: options?.sort || 'newest',
        experience_level: options?.experienceLevel || ['IntermediateLevel', 'ExpertLevel'],
        hourly: true,
        fixed: true,
        authentication: 'no_authentication',
      });

      this.logger.log(`Corrida finalizada con status: ${run.status}. Obteniendo dataset...`);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      return items as unknown as RawApifyUpworkJob[];
    } catch (error) {
      this.logger.error('Error al ejecutar Apify Actor:', error);
      throw error;
    }
  }
}
