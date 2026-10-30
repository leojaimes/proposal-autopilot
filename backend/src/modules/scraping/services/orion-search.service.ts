import { Injectable, Logger, Optional } from '@nestjs/common';

export interface OrionSearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
}

export interface OrionSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  raw_content?: string;
}

export interface OrionExtractResult {
  url: string;
  raw_content: string;
}

@Injectable()
export class OrionSearchService {
  private readonly logger = new Logger(OrionSearchService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    @Optional() customBaseUrl?: string,
    @Optional() customTimeoutMs?: number,
  ) {
    this.baseUrl = (
      customBaseUrl ||
      process.env.ORION_SEARCH_URL ||
      'https://pepper-tix-orio-search.zh4nwb.easypanel.host'
    ).replace(/\/+$/, '');
    this.timeoutMs = customTimeoutMs || Number(process.env.ORION_TIMEOUT_MS) || 15000;
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.baseUrl.startsWith('http'));
  }

  /**
   * Realiza una búsqueda web a través de Orion (SearXNG).
   */
  async search(
    query: string,
    options?: OrionSearchOptions,
  ): Promise<OrionSearchResult[]> {
    if (!this.isConfigured || !query?.trim()) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}/search`;
      const body = {
        query: query.trim(),
        search_depth: options?.searchDepth || 'basic',
        max_results: options?.maxResults || 5,
        include_answer: options?.includeAnswer ?? false,
        include_raw_content: options?.includeRawContent ?? false,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        this.logger.warn(`Orion Search failed with status ${res.status} for query "${query}"`);
        return [];
      }

      const data = (await res.json()) as any;
      const rawResults = Array.isArray(data.results) ? data.results : [];

      return rawResults.map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || r.snippet || '',
        score: r.score,
        raw_content: r.raw_content || r.content,
      }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.logger.warn(`Orion Search error for query "${query}": ${err.message}`);
      return [];
    }
  }

  /**
   * Extrae el contenido en Markdown limpio de una lista de URLs usando Trafilatura / Readability en Orion.
   */
  async extract(
    urls: string[],
    format: 'markdown' | 'text' = 'markdown',
  ): Promise<OrionExtractResult[]> {
    const validUrls = (urls || []).filter((u) => typeof u === 'string' && u.startsWith('http'));
    if (!this.isConfigured || validUrls.length === 0) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}/extract`;
      const body = {
        urls: validUrls,
        format,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        this.logger.warn(`Orion Extract failed with status ${res.status}`);
        return [];
      }

      const data = (await res.json()) as any;
      const rawResults = Array.isArray(data.results) ? data.results : [];

      return rawResults.map((r: any) => ({
        url: r.url || '',
        raw_content: r.raw_content || r.content || '',
      }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.logger.warn(`Orion Extract error: ${err.message}`);
      return [];
    }
  }
}
