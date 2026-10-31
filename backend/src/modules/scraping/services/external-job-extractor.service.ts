import { Injectable, Logger, Optional } from '@nestjs/common';
import { LambdaLinkedInScraperService } from './lambda-linkedin-scraper.service';
import { OrionSearchService } from './orion-search.service';

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
    @Optional() private readonly lambdaScraper?: LambdaLinkedInScraperService,
    @Optional() private readonly orionSearch?: OrionSearchService,
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
        /(?:Engineer|Developer|Architect|Lead|Full Stack|Backend|Frontend|Data|DevOps|Manager|Designer)/i.test(l),
      );
      if (lineWithTech) {
        title = lineWithTech.replace(/^[^a-zA-Z0-9]+/, '').trim().slice(0, 100);
      }
    }

    // Extracción de empresa
    const companyName = this.extractCompanyName(text);

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
   * Extrae la vacante desde cualquier URL (Workday, LinkedIn, Greenhouse, Lever, Indeed, o web corporativa).
   */
  async extractFromUrl(jobUrl: string): Promise<ExtractedJobData> {
    const url = (jobUrl || '').trim();
    if (!url) {
      throw new Error('Job URL cannot be empty');
    }

    // 1. Adaptador nativo Workday
    if (url.includes('myworkdayjobs.com')) {
      try {
        return await this.extractFromWorkdayUrl(url);
      } catch (err: any) {
        this.logger.warn(`Workday native extraction failed, falling back to universal extractor: ${err.message}`);
      }
    }

    // 2. Adaptador nativo LinkedIn
    if (url.includes('linkedin.com')) {
      try {
        return await this.extractFromLinkedInUrl(url);
      } catch (err: any) {
        this.logger.warn(`LinkedIn native extraction failed, falling back to universal extractor: ${err.message}`);
      }
    }

    // 3. Extractor Universal para Cualquier Portal (Greenhouse, Lever, Indeed, Ashby, Web propia)
    return await this.extractFromUniversalUrl(url);
  }

  /**
   * Extractor universal que consume Orion (Trafilatura) o fetch directo para parsear cualquier URL de internet.
   */
  private async extractFromUniversalUrl(url: string): Promise<ExtractedJobData> {
    let cleanText = '';

    // Intento A: Vía Orion Extract (Trafilatura/Readability)
    if (this.orionSearch && this.orionSearch.isConfigured) {
      try {
        const extractedResults = await this.orionSearch.extract([url], 'markdown');
        if (extractedResults && extractedResults.length > 0 && extractedResults[0].raw_content) {
          cleanText = extractedResults[0].raw_content.trim();
        }
      } catch (err: any) {
        this.logger.warn(`Orion extract failed for ${url}: ${err.message}`);
      }
    }

    // Intento B: Fetch directo de HTML con Headers de Navegador si Orion no trajo contenido
    if (!cleanText || cleanText.length < 50) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
          },
        });

        if (res.ok) {
          const html = await res.text();
          // Limpieza rápida de HTML a texto plano legible
          cleanText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (fetchErr: any) {
        this.logger.error(`Direct fetch failed for ${url}: ${fetchErr.message}`);
      }
    }

    if (!cleanText || cleanText.length < 50) {
      throw new Error(
        `No pudimos extraer el texto de la vacante automáticamente desde ${url}. Por favor, copia el texto de la vacante y pégalo en la pestaña "Pegar Descripción".`,
      );
    }

    // Validación semántica estricta: asegurar que el contenido extraído sea realmente una vacante de empleo
    this.assertJobPostingContent(cleanText, url);

    // Estructurar con la lógica de inferencia
    const structured = await this.extractFromRawText(cleanText);

    // Deducir nombre de empresa del dominio si no se detectó
    if (structured.companyName === 'Hiring Team') {
      try {
        const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
        if (domain && domain.length > 2 && !['jobs', 'careers', 'boards', 'linkedin', 'indeed'].includes(domain)) {
          structured.companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
        }
      } catch {
        // Ignored
      }
    }

    return {
      ...structured,
      jobUrl: url,
    };
  }

  /**
   * Valida heurísticamente que el texto y la URL correspondan a una vacante real de empleo
   * para evitar gastar tokens de IA procesando sitios web arbitrarios (blogs, tiendas, videos).
   */
  private assertJobPostingContent(text: string, url: string): void {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    // 1. Si proviene de un ATS reconocido o ruta canónica de empleo, tiene pase rápido
    const KNOWN_ATS_DOMAINS = [
      'greenhouse.io',
      'lever.co',
      'myworkdayjobs.com',
      'workdayjobs.com',
      'ashbyhq.com',
      'workable.com',
      'bamboohr.com',
      'smartrecruiters.com',
      'jobvite.com',
      'breezy.hr',
      'rippling.com',
      'recruitee.com',
      'indeed.com',
      'linkedin.com',
    ];

    const isFromKnownAts = KNOWN_ATS_DOMAINS.some((domain) => lowerUrl.includes(domain));
    const hasJobUrlPattern = /(?:\/jobs?\/|\/careers?\/|\/openings?\/|\/positions?\/|\/vacantes?\/|\/apply\/)/.test(
      lowerUrl,
    );

    // 2. Grupos de señales de contratación en el cuerpo del texto
    const SIGNALS = {
      role: [
        'responsibilities',
        'responsabilidades',
        'what you will do',
        'lo que haras',
        'lo que harás',
        'about the role',
        'sobre el puesto',
        'about the job',
        'key duties',
        'job overview',
      ],
      requirements: [
        'requirements',
        'requisitos',
        'qualifications',
        'what you need',
        'what you bring',
        'skills',
        'habilidades',
        'experiencia minima',
        'experiencia mínima',
        'years of experience',
        'años de experiencia',
        'tech stack',
      ],
      compensation_or_type: [
        'full-time',
        'part-time',
        'tiempo completo',
        'medio tiempo',
        'remote',
        'remoto',
        'hybrid',
        'hibrido',
        'híbrido',
        'salary',
        'salario',
        'sueldo',
        'benefits',
        'prestaciones',
        'compensation',
      ],
      action: [
        'apply',
        'postularse',
        'apply now',
        'submit application',
        'enviar solicitud',
        'send cv',
        'enviar cv',
        'join our team',
        'unete a nuestro equipo',
      ],
    };

    let matchedGroups = 0;
    if (SIGNALS.role.some((keyword) => lowerText.includes(keyword))) matchedGroups++;
    if (SIGNALS.requirements.some((keyword) => lowerText.includes(keyword))) matchedGroups++;
    if (SIGNALS.compensation_or_type.some((keyword) => lowerText.includes(keyword))) matchedGroups++;
    if (SIGNALS.action.some((keyword) => lowerText.includes(keyword))) matchedGroups++;

    // Si viene de ATS o URL de empleo, basta 1 grupo de señales; si es web general, requiere al menos 2
    const minRequiredSignals = isFromKnownAts || hasJobUrlPattern ? 1 : 2;

    if (matchedGroups < minRequiredSignals) {
      this.logger.warn(`Rejected URL "${url}": Only matched ${matchedGroups}/${minRequiredSignals} job signal groups.`);
      throw new Error(
        `La URL ingresada no parece corresponder a una vacante de empleo válida (no se detectaron responsabilidades, requisitos técnicos ni opciones de postulación). Si se trata de una página privada, copia el texto y pégalo directamente en la pestaña "Pegar Descripción".`,
      );
    }
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

  private extractCompanyName(text: string): string {
    // 1. Explicit labels: "Company: Acme", "Empresa: Acme", "Client: Acme"
    const explicitMatch = text.match(/(?:Company|Organization|Empresa|Client|Cliente|Hiring Organization|Hiring Company)\s*[:\-]\s*([^\r\n,;]+)/i);
    if (explicitMatch && explicitMatch[1].trim()) {
      return explicitMatch[1].trim();
    }

    // 2. "About <Company>:" or "Acerca de <Company>:"
    const aboutMatch = text.match(/(?:About|Acerca de|Sobre)\s+([A-Z0-9][A-Za-z0-9&.\- ]{1,35})[:\r\n]/i);
    if (aboutMatch && aboutMatch[1].trim()) {
      const candidate = aboutMatch[1].trim();
      const isGeneric = /^(?:the\s+(?:job|role|position|team|company|opportunity|client)|us|our\s+team|este\s+rol|la\s+empresa|nosotros)$/i.test(candidate);
      if (!isGeneric) {
        return candidate;
      }
    }

    // 3. "<Role> at <Company>" or "<Role> en <Company>" (e.g. Senior Backend Engineer at Spotify)
    const atMatch = text.match(/(?:Engineer|Developer|Architect|Lead|Manager|Consultant|Specialist|Programmer|Desarrollador|Ingeniero)\s+(?:at|en|@)\s+([A-Z0-9][A-Za-z0-9&.\- ]{1,35})/i);
    if (atMatch && atMatch[1].trim()) {
      const candidate = atMatch[1].trim();
      const isGeneric = /^(?:the\s+|our\s+|a\s+|este\s+)/i.test(candidate);
      if (!isGeneric) {
        return candidate;
      }
    }

    // 4. "At <Company>, we..." or "En <Company>, ..."
    const atWeMatch = text.match(/(?:At|En|Join|Únete a)\s+([A-Z0-9][A-Za-z0-9&.\- ]{1,25})(?:,|\s+(?:we\b|we're\b|our\b|you\b|buscamos\b|es\b|is\b|to\b))/i);
    if (atWeMatch && atWeMatch[1].trim()) {
      const candidate = atWeMatch[1].trim();
      const isGeneric = /^(?:this\s+time|least|present|este|nuestra)/i.test(candidate);
      if (!isGeneric) {
        return candidate;
      }
    }

    // 5. Default fallback (never hardcoded 'Litera')
    return 'Hiring Team';
  }
}

