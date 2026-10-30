import { Injectable, Logger } from '@nestjs/common';
import { OrionSearchService } from './orion-search.service';

export interface CompanyProfile {
  companyName: string;
  website?: string;
  industry?: string;
  coreProduct?: string;
  targetAudience?: string;
  valueProposition?: string;
  summary: string;
  enriched: boolean;
}

const AGGREGATOR_DOMAINS = [
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'myworkdayjobs.com',
  'workdayjobs.com',
  'greenhouse.io',
  'lever.co',
  'ziprecruiter.com',
  'wikipedia.org',
  'bloomberg.com',
  'reuters.com',
  'crunchbase.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
];

@Injectable()
export class CompanyEnricherService {
  private readonly logger = new Logger(CompanyEnricherService.name);
  private readonly cache = new Map<string, { profile: CompanyProfile; timestamp: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  private readonly geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.AI_STUDIO_API_KEY;
  private readonly geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  constructor(
    private readonly orionSearch: OrionSearchService,
  ) {}

  /**
   * Enriquece los datos de la empresa descubriendo su sitio web oficial y sintetizando
   * su nicho, producto clave y propuesta de valor a costo $0 con Orion + Gemini.
   */
  async enrichCompany(
    companyName: string,
    location?: string,
    knownJobUrl?: string,
  ): Promise<CompanyProfile> {
    const rawName = (companyName || '').trim();
    if (!rawName || /^(?:Hiring Team|Client|Confidential|Empresa|Company)$/i.test(rawName)) {
      return {
        companyName: rawName || 'Hiring Team',
        summary: '',
        enriched: false,
      };
    }

    const cacheKey = rawName.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.profile;
    }

    try {
      // 1. Descubrir sitio web oficial
      let targetUrl: string | undefined;

      // Si knownJobUrl nos da pista de Workday (ej: https://litera.wd12.myworkdayjobs.com)
      if (knownJobUrl && knownJobUrl.includes('myworkdayjobs.com')) {
        try {
          const tenant = new URL(knownJobUrl).hostname.split('.')[0];
          if (tenant && tenant.length > 2) {
            targetUrl = `https://www.${tenant}.com`;
          }
        } catch {
          // ignore error
        }
      }

      // Si no tenemos URL directa, buscamos en Orion
      if (!targetUrl) {
        const queryLocation = (location || '').replace(/remote|remoto/gi, '').trim();
        const searchQuery = queryLocation
          ? `"${rawName}" "${queryLocation}" official website`
          : `"${rawName}" company official website`;

        const searchResults = await this.orionSearch.search(searchQuery, { maxResults: 5 });

        // Filtrar bolsas de empleo y redes sociales
        const candidate = searchResults.find((r) => {
          try {
            const parsed = new URL(r.url);
            const host = parsed.hostname.toLowerCase();
            return !AGGREGATOR_DOMAINS.some((agg) => host.includes(agg));
          } catch {
            return false;
          }
        });

        if (candidate?.url) {
          targetUrl = candidate.url;
        }
      }

      // 2. Extraer contenido en Markdown vía Orion
      let rawMarkdown = '';
      if (targetUrl) {
        const extracts = await this.orionSearch.extract([targetUrl], 'markdown');
        if (extracts.length > 0 && extracts[0].raw_content) {
          rawMarkdown = extracts[0].raw_content;
        }
      }

      // 3. Sintetizar perfil con Gemini (o fallback con heurística)
      const profile = await this.synthesizeProfile(rawName, targetUrl, rawMarkdown);
      this.cache.set(cacheKey, { profile, timestamp: Date.now() });
      return profile;
    } catch (err: any) {
      this.logger.warn(`Error enriching company "${rawName}": ${err.message}. Returning base profile.`);
      return {
        companyName: rawName,
        summary: '',
        enriched: false,
      };
    }
  }

  private async synthesizeProfile(
    companyName: string,
    website?: string,
    markdown?: string,
  ): Promise<CompanyProfile> {
    const trimmedMd = (markdown || '').slice(0, 10000).trim();

    // Si Gemini está disponible y tenemos contenido
    if (this.geminiApiKey && trimmedMd) {
      try {
        const prompt = `You are a corporate intelligence analyst.
Analyze the following official company website markdown for "${companyName}":

"""
${trimmedMd}
"""

Return a JSON with:
{
  "industry": "e.g. LegalTech / B2B SaaS",
  "coreProduct": "1 concise sentence describing what product or platform they build",
  "targetAudience": "e.g. Law firms and enterprise legal departments",
  "valueProposition": "1 sentence describing their main market advantage or mission",
  "summary": "2 sentences summarizing what the company does and why their software matters."
}
Respond with PURE JSON ONLY.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (res.ok) {
          const payload = (await res.json()) as any;
          const jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = JSON.parse(jsonText);

          return {
            companyName,
            website,
            industry: parsed.industry || 'Technology',
            coreProduct: parsed.coreProduct,
            targetAudience: parsed.targetAudience,
            valueProposition: parsed.valueProposition,
            summary: parsed.summary || `${companyName} is a technology provider specializing in ${parsed.industry || 'software solutions'}.`,
            enriched: true,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Gemini synthesis failed for "${companyName}": ${err.message}`);
      }
    }

    // Heurística de fallback cuando no hay Gemini o falló
    const lines = trimmedMd.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('Source:'));
    const firstLine = lines.slice(0, 3).join(' ').slice(0, 250);

    return {
      companyName,
      website,
      summary: firstLine ? `${companyName}: ${firstLine}` : `${companyName} technology platform.`,
      enriched: Boolean(website || trimmedMd),
    };
  }
}
