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
      if (!keywords || keywords.length === 0) {
        throw new Error('No se proporcionaron palabras clave (keywords) para el scraper de Upwork.');
      }
      this.logger.log(`Iniciando scraping en Apify con ${keywords.length} queries: ${keywords.join(' | ')} | Max: ${maxResults}`);

      // Actor flash_mage/upwork: el schema exige un máximo estricto de 5 items en 'query'
      const sanitizedQueries = keywords.slice(0, 5);

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
      this.logger.error('Error al ejecutar Apify Actor Upwork:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el actor de extracción de empleos de LinkedIn (curious_coder/linkedin-jobs-scraper)
   */
  async runLinkedInScraper(
    keywords: string[],
    maxResults: number = 20,
    locations: string[] = ['Remote']
  ): Promise<Record<string, any>[]> {
    try {
      if (!keywords || keywords.length === 0) {
        throw new Error('No se proporcionaron palabras clave (keywords) para el scraper de LinkedIn.');
      }
      const sanitizedQueries = keywords.slice(0, 5);

      const activeLocations = (locations && locations.length > 0) ? locations : ['Remote'];

      // Construir URLs de búsqueda directas de LinkedIn para cada query y cada ubicación/país objetivo
      const searchUrls: string[] = [];
      for (const q of sanitizedQueries) {
        const cleanTerm = q.replace(/[()"]/g, '').replace(/\s+(AND|OR)\s+/gi, ' ').trim();
        for (const loc of activeLocations) {
          searchUrls.push(
            `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(cleanTerm)}&location=${encodeURIComponent(loc)}`
          );
        }
      }

      // Proteger contra demasiadas combinaciones (máximo 10 URLs de búsqueda)
      const finalUrls = searchUrls.slice(0, 10);

      // Distribuir el límite entre las URLs de búsqueda configuradas (mínimo 3 por URL)
      const limitPerSource = Math.max(3, Math.ceil(maxResults / Math.max(1, finalUrls.length)));

      this.logger.log(`Iniciando LinkedIn Scrape en Apify con ${finalUrls.length} URLs de búsqueda (Ubicaciones: ${activeLocations.join(', ')}): ${finalUrls[0]} | Max total: ${maxResults} | LimitPerSource: ${limitPerSource}`);

      const run = await this.client.actor('curious_coder/linkedin-jobs-scraper').call({
        urls: finalUrls,
        limitPerSource,
        scrapeCompany: false, // Desactivado para no agotar el ancho de banda del proxy residencial
      });

      this.logger.log(`LinkedIn run finalizada con status: ${run.status}. Obteniendo dataset...`);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      return (items as Record<string, any>[]).slice(0, maxResults);
    } catch (error) {
      this.logger.error('Error al ejecutar Apify Actor LinkedIn:', error);
      throw error;
    }
  }
}
