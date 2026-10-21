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

      // Actor flash_mage/upwork: el schema exige un máximo estricto de 5 items en 'query'
      const sanitizedQueries = (keywords && keywords.length > 0)
        ? keywords.slice(0, 5)
        : ['UI/UX design', 'UX/UI designer', 'UX research', 'design system', 'AI product design'];

      this.logger.log(`Enviando ${sanitizedQueries.length} queries a Apify (máx 5 permitido por actor): ${sanitizedQueries.join(' | ')}`);

      const run = await this.client.actor('flash_mage/upwork').call({
        query: sanitizedQueries,
        limit: maxResults,
        sort: options?.sort || 'relevance',
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
