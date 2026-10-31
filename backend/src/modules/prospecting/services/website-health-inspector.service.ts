import { Injectable, Logger } from '@nestjs/common';
import { validateExternalBusinessUrlWithDns } from '../utils/url-safety.util';

export type WebsiteHealthCategory =
  | 'HEALTHY'
  | 'NO_WEBSITE'
  | 'SOCIAL_ONLY'
  | 'DOWN_OR_EXPIRED'
  | 'SLOW_OR_INSECURE'
  | 'SSRF_BLOCKED';

export interface WebsiteHealthReport {
  category: WebsiteHealthCategory;
  httpStatus: number | null;
  responseTimeMs: number | null;
  isSsl: boolean;
  isParkedDomain: boolean;
  rootDomain: string | null;
  reason?: string;
}

const PARKED_DOMAIN_SIGNATURES = [
  'sedoparking',
  'godaddy.com/forsale',
  'hugedomains.com',
  'afternic.com',
  'dan.com/buy-domain',
  'this domain is for sale',
  'este dominio esta en venta',
  'este dominio está en venta',
  'domain expired',
  'account suspended',
  'cgi-sys/suspendedpage.cgi',
];

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 3500;

@Injectable()
export class WebsiteHealthInspectorService {
  private readonly logger = new Logger(WebsiteHealthInspectorService.name);

  async inspectWebsite(
    rawUrl?: string | null,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<WebsiteHealthReport> {
    if (!rawUrl || !rawUrl.trim()) {
      return {
        category: 'NO_WEBSITE',
        httpStatus: null,
        responseTimeMs: null,
        isSsl: false,
        isParkedDomain: false,
        rootDomain: null,
        reason: 'EMPTY_URL',
      };
    }

    const initialValidation = await validateExternalBusinessUrlWithDns(rawUrl);
    if (initialValidation.isSocialOrDirectory) {
      return {
        category: 'SOCIAL_ONLY',
        httpStatus: null,
        responseTimeMs: null,
        isSsl: true,
        isParkedDomain: false,
        rootDomain: initialValidation.rootDomain ?? null,
        reason: 'SOCIAL_OR_DIRECTORY_LINK',
      };
    }

    if (!initialValidation.isSafe || !initialValidation.normalizedUrl) {
      if (initialValidation.reason === 'DNS_NXDOMAIN') {
        return {
          category: 'DOWN_OR_EXPIRED',
          httpStatus: 0,
          responseTimeMs: null,
          isSsl: false,
          isParkedDomain: false,
          rootDomain: initialValidation.rootDomain ?? null,
          reason: 'DNS_NXDOMAIN',
        };
      }

      if (initialValidation.reason?.startsWith('SSRF_BLOCKED')) {
        this.logger.warn(`Blocked unsafe website inspection URL (${initialValidation.reason}): ${rawUrl}`);
        return {
          category: 'SSRF_BLOCKED',
          httpStatus: null,
          responseTimeMs: null,
          isSsl: false,
          isParkedDomain: false,
          rootDomain: null,
          reason: initialValidation.reason,
        };
      }

      return {
        category: 'DOWN_OR_EXPIRED',
        httpStatus: 0,
        responseTimeMs: null,
        isSsl: false,
        isParkedDomain: false,
        rootDomain: initialValidation.rootDomain ?? null,
        reason: initialValidation.reason || 'UNREACHABLE',
      };
    }

    let currentUrl = initialValidation.normalizedUrl;
    const startTime = Date.now();

    try {
      let response: Response | null = null;

      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        response = await this.performTimedFetch(currentUrl, 'HEAD', timeoutMs);

        // Some origins block HEAD with 405 or 403; retry once with GET
        if (response.status === 405 || response.status === 501) {
          response = await this.performTimedFetch(currentUrl, 'GET', timeoutMs);
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) break;

          const resolvedRedirect = new URL(location, currentUrl).toString();
          const hopCheck = await validateExternalBusinessUrlWithDns(resolvedRedirect);
          if (!hopCheck.isSafe || !hopCheck.normalizedUrl) {
            return {
              category: hopCheck.reason?.startsWith('SSRF_BLOCKED')
                ? 'SSRF_BLOCKED'
                : 'DOWN_OR_EXPIRED',
              httpStatus: response.status,
              responseTimeMs: Date.now() - startTime,
              isSsl: resolvedRedirect.startsWith('https://'),
              isParkedDomain: false,
              rootDomain: initialValidation.rootDomain ?? null,
              reason: hopCheck.reason || 'UNSAFE_REDIRECT',
            };
          }
          currentUrl = hopCheck.normalizedUrl;
          continue;
        }
        break;
      }

      const elapsedMs = Date.now() - startTime;
      const finalStatus = response ? response.status : 0;
      const isSsl = currentUrl.startsWith('https://');

      if (finalStatus === 404 || finalStatus === 410 || finalStatus >= 500 || finalStatus === 0) {
        return {
          category: 'DOWN_OR_EXPIRED',
          httpStatus: finalStatus,
          responseTimeMs: elapsedMs,
          isSsl,
          isParkedDomain: false,
          rootDomain: initialValidation.rootDomain ?? null,
          reason: `HTTP_${finalStatus}`,
        };
      }

      // Inspect lightweight HTML body snippet to detect parked/expired landing pages
      let isParked = false;
      try {
        const getRes = await this.performTimedFetch(currentUrl, 'GET', Math.min(timeoutMs, 2500));
        const textChunk = (await getRes.text()).slice(0, 8192).toLowerCase();
        isParked = PARKED_DOMAIN_SIGNATURES.some((sig) => textChunk.includes(sig));
      } catch {
        // Ignore body snippet errors if HEAD succeeded
      }

      if (isParked) {
        return {
          category: 'DOWN_OR_EXPIRED',
          httpStatus: finalStatus,
          responseTimeMs: elapsedMs,
          isSsl,
          isParkedDomain: true,
          rootDomain: initialValidation.rootDomain ?? null,
          reason: 'PARKED_OR_SUSPENDED_DOMAIN',
        };
      }

      if (!isSsl || elapsedMs > 2800) {
        return {
          category: 'SLOW_OR_INSECURE',
          httpStatus: finalStatus,
          responseTimeMs: elapsedMs,
          isSsl,
          isParkedDomain: false,
          rootDomain: initialValidation.rootDomain ?? null,
          reason: !isSsl ? 'INSECURE_HTTP_NO_SSL' : 'HIGH_TTFB_LATENCY',
        };
      }

      return {
        category: 'HEALTHY',
        httpStatus: finalStatus,
        responseTimeMs: elapsedMs,
        isSsl,
        isParkedDomain: false,
        rootDomain: initialValidation.rootDomain ?? null,
      };
    } catch (err: any) {
      const elapsedMs = Date.now() - startTime;
      const isTimeout = err?.name === 'AbortError';
      return {
        category: isTimeout ? 'SLOW_OR_INSECURE' : 'DOWN_OR_EXPIRED',
        httpStatus: 0,
        responseTimeMs: elapsedMs,
        isSsl: currentUrl.startsWith('https://'),
        isParkedDomain: false,
        rootDomain: initialValidation.rootDomain ?? null,
        reason: isTimeout ? 'HTTP_TIMEOUT' : err?.message || 'CONNECTION_FAILED',
      };
    }
  }

  private async performTimedFetch(
    url: string,
    method: 'HEAD' | 'GET',
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SpotlightAuditBot/2.0 (+https://spotlightus.org)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

