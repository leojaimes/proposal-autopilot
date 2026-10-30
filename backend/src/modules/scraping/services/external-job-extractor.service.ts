import { Injectable, Logger } from '@nestjs/common';
import { LambdaLinkedInScraperService } from './lambda-linkedin-scraper.service';

export interface ExtractedJobData {
  title: string;
  companyName: string;
  location: string;
  description: string;
  requiredSkills: string[];
  jobUrl?: string;
  postedAt?: Date;
  rawPayload?: Record<string, any>;
}

@Injectable()
export class ExternalJobExtractorService {
  private readonly logger = new Logger(ExternalJobExtractorService.name);

  constructor(
    private readonly lambdaScraper?: LambdaLinkedInScraperService,
  ) {}

  /**
   * Extrae metadatos estructurados a partir del texto crudo pegado por el usuario.
   */
  async extractFromRawText(rawText: string): Promise<ExtractedJobData> {
    const text = (rawText || '').trim();
    if (!text) {
      throw new Error('Raw job text cannot be empty');
    }

    // Extracción de título de rol
    let title = 'Senior Software Engineer';
    const roleMatch = text.match(/(?:Role|Position|Title|Puesto|Cargo):\s*([^\r\n]+)/i);
    if (roleMatch && roleMatch[1].trim()) {
      title = roleMatch[1].trim();
    } else {
      const lineWithTech = text.split('\n').find((l) =>
        /(?:Engineer|Developer|Architect|Lead|Full Stack|Backend|Frontend|Data|DevOps)/i.test(l),
      );
      if (lineWithTech) {
        title = lineWithTech.replace(/^[^a-zA-Z0-9]+/, '').trim().slice(0, 100);
      }
    }

    // Extracción de empresa
    let companyName = 'Litera';
    const companyMatch = text.match(/(?:Company|Organization|Empresa|Client|Hiring):\s*([^\r\n]+)/i);
    if (companyMatch && companyMatch[1].trim()) {
      companyName = companyMatch[1].trim();
    }

    // Extracción de ubicación
    let location = 'Remote, United States';
    const locationMatch = text.match(/(?:Location|Ubicación|City|Ciudad):\s*([^\r\n]+)/i);
    if (locationMatch && locationMatch[1].trim()) {
      location = locationMatch[1].trim();
    }

    // Detección de habilidades técnicas clave
    const KNOWN_SKILLS = [
      'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Golang', 'Java', 'C#', '.NET',
      'Angular', 'Vue', 'React', 'Next.js', 'Nuxt', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
      'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'GraphQL', 'REST', 'Tailwind', 'Microservices'
    ];

    const detectedSkills = new Set<string>();
    for (const skill of KNOWN_SKILLS) {
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:^|\\b|\\W)${escaped}(?:\\b|\\W|$)`, 'i');
      if (regex.test(text)) {
        detectedSkills.add(skill);
      }
    }

    return {
      title,
      companyName,
      location,
      description: text,
      requiredSkills: Array.from(detectedSkills),
      postedAt: new Date(),
    };
  }

  /**
   * Extrae la vacante desde una URL específica (Workday, LinkedIn o genérica).
   */
  async extractFromUrl(jobUrl: string): Promise<ExtractedJobData> {
    const url = (jobUrl || '').trim();
    if (!url) {
      throw new Error('Job URL cannot be empty');
    }

    if (url.includes('myworkdayjobs.com')) {
      return this.extractFromWorkdayUrl(url);
    }

    if (url.includes('linkedin.com')) {
      return this.extractFromLinkedInUrl(url);
    }

    throw new Error(`Unsupported URL provider for ${url}`);
  }

  private async extractFromLinkedInUrl(url: string): Promise<ExtractedJobData> {
    if (!this.lambdaScraper) {
      throw new Error('Lambda LinkedIn scraper is not configured');
    }

    const results = await this.lambdaScraper.scrapeJobs({
      keywords: [],
      jobUrl: url,
      limit: 1,
    } as any);

    if (!results || results.length === 0) {
      throw new Error(`Failed to extract LinkedIn job from ${url}`);
    }

    const job = results[0];
    const desc = job.descriptionText || job.description || '';
    const extracted = await this.extractFromRawText(desc || job.title);

    return {
      ...extracted,
      title: job.title || extracted.title,
      companyName: job.companyName || extracted.companyName,
      location: job.location || extracted.location,
      description: desc,
      jobUrl: url,
      postedAt: job.postedDate ? new Date(job.postedDate) : new Date(),
      rawPayload: job,
    };
  }

  private async extractFromWorkdayUrl(url: string): Promise<ExtractedJobData> {
    try {
      const parsed = new URL(url);
      const host = parsed.host;
      const tenant = host.split('.')[0];
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const careerSite = pathParts[0] || 'careers';
      const jobIdx = pathParts.indexOf('job');
      const jobSubPath = jobIdx !== -1 ? pathParts.slice(jobIdx + 1).join('/') : pathParts.slice(1).join('/');

      const cxsUrl = `https://${host}/wday/cxs/${tenant}/${careerSite}/job/${jobSubPath}`;
      const response = await fetch(cxsUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });

      if (!response.ok) {
        throw new Error(`Workday CXS API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const info = data.jobPostingInfo || {};
      const rawHtml = info.jobDescription || '';
      const cleanDesc = rawHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      const extracted = await this.extractFromRawText(cleanDesc || info.title || 'Senior Software Engineer');

      let company = tenant.charAt(0).toUpperCase() + tenant.slice(1);
      if (typeof data.hiringOrganization === 'string' && data.hiringOrganization.trim()) {
        company = data.hiringOrganization.trim();
      } else if (typeof data.hiringOrganization === 'object' && data.hiringOrganization?.name) {
        company = String(data.hiringOrganization.name).trim();
      }

      return {
        ...extracted,
        title: info.title || extracted.title,
        companyName: company || extracted.companyName,
        location: info.location || extracted.location,
        description: cleanDesc,
        jobUrl: url,
        postedAt: (() => {
          if (info.postedOn) {
            const d = new Date(info.postedOn);
            if (!isNaN(d.getTime())) return d;
          }
          return new Date();
        })(),
        rawPayload: data,
      };
    } catch (err: any) {
      this.logger.error(`Error extracting Workday job from ${url}: ${err.message}`);
      throw err;
    }
  }
}

