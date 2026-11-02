import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'node:dns';

/**
 * Granular deliverability and validation status classification for B2B prospecting emails.
 */
export enum EmailValidationResultStatus {
  /**
   * RFC 5322 syntax is valid and active DNS MX (Mail Exchange) mail servers were resolved.
   * Safe to persist in the CRM as a deliverable contact candidate.
   */
  VALID_DELIVERABLE = 'VALID_DELIVERABLE',

  /**
   * Domain was resolved but has zero active DNS MX records (or domain does not exist in DNS).
   * Direct 100% hard bounce risk: prevents sender reputation penalty and burns.
   */
  DOMAIN_NO_MX = 'DOMAIN_NO_MX',

  /**
   * Transient network timeout or DNS server resolution error (e.g. SERVFAIL, ETIMEOUT).
   * Preserved as UNVERIFIED rather than permanently disqualified.
   */
  DNS_TEMPORARY_ERROR = 'DNS_TEMPORARY_ERROR',

  /**
   * Known CMS template, framework boilerplate, or infrastructure email (e.g. wix.com, example.com, sentry.io).
   * Disqualified to avoid polluting CRM with mock contacts.
   */
  DISQUALIFIED_TEMPLATE = 'DISQUALIFIED_TEMPLATE',

  /**
   * Malformed email syntax failing strict RFC 5322 structure.
   */
  INVALID_SYNTAX = 'INVALID_SYNTAX',
}

export interface EmailMxRecord {
  exchange: string;
  priority: number;
}

export interface EmailValidationResult {
  originalEmail: string;
  normalizedEmail?: string;
  domain?: string;
  status: EmailValidationResultStatus;
  isDeliverableCandidate: boolean;
  mxRecords?: EmailMxRecord[];
  disqualificationReason?: string;
  dnsError?: string;
}

interface CachedDnsResolution {
  status: EmailValidationResultStatus;
  mxRecords?: EmailMxRecord[];
  error?: string;
  cachedAt: number;
}

/**
 * Service to sanitize and validate commercial B2B emails.
 * Performs strict RFC 5322 syntax validation, checks against configurable
 * infrastructure/template blacklists, and queries DNS MX records with timeout & in-memory caching.
 */
@Injectable()
export class EmailValidationService {
  private readonly logger = new Logger(EmailValidationService.name);

  // Configurable template / placeholder domains that do not represent commercial contacts
  private readonly disqualifiedDomains = new Set<string>([
    'example.com',
    'example.org',
    'example.net',
    'wix.com',
    'wixpress.com',
    'wordpress.org',
    'wordpress.com',
    'sentry.io',
    'sentry-cdn.com',
    'localhost',
    'test.com',
    'domain.com',
    'mysite.com',
    'yoursite.com',
    'sitename.com',
    'placeholder.com',
  ]);

  // Common placeholder local parts found in website templates
  private readonly disqualifiedLocalParts = new Set<string>([
    'yourname',
    'user',
    'username',
    'name',
    'example',
    'test',
    'email',
    'correo',
    'tuemail',
  ]);

  // DNS cache with 1-hour TTL
  private readonly dnsCache = new Map<string, CachedDnsResolution>();
  private readonly cacheTtlMs = 60 * 60 * 1000; // 1 hour
  private readonly dnsTimeoutMs = 2500; // 2.5 seconds timeout

  /**
   * Sanitizes, normalizes, and validates an email address.
   */
  async validateEmail(rawEmail: string): Promise<EmailValidationResult> {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return {
        originalEmail: String(rawEmail || ''),
        status: EmailValidationResultStatus.INVALID_SYNTAX,
        isDeliverableCandidate: false,
        disqualificationReason: 'Empty or non-string email value',
      };
    }

    const trimmed = rawEmail.trim();

    // 1. Strict RFC 5322 regex validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed)) {
      return {
        originalEmail: rawEmail,
        status: EmailValidationResultStatus.INVALID_SYNTAX,
        isDeliverableCandidate: false,
        disqualificationReason: 'Email fails RFC 5322 syntax validation',
      };
    }

    const [localPart, domainRaw] = trimmed.split('@');
    const domain = (domainRaw || '').toLowerCase();
    const normalizedEmail = `${localPart.toLowerCase()}@${domain}`;

    // 2. Disqualified template / infrastructure filter
    if (this.disqualifiedDomains.has(domain) || Array.from(this.disqualifiedDomains).some((d) => domain.endsWith(`.${d}`))) {
      return {
        originalEmail: rawEmail,
        normalizedEmail,
        domain,
        status: EmailValidationResultStatus.DISQUALIFIED_TEMPLATE,
        isDeliverableCandidate: false,
        disqualificationReason: `Domain "${domain}" is a known CMS template or infrastructure domain`,
      };
    }

    if (this.disqualifiedLocalParts.has(localPart.toLowerCase())) {
      return {
        originalEmail: rawEmail,
        normalizedEmail,
        domain,
        status: EmailValidationResultStatus.DISQUALIFIED_TEMPLATE,
        isDeliverableCandidate: false,
        disqualificationReason: `Local part "${localPart}" is a generic template placeholder`,
      };
    }

    // 3. DNS MX check with timeout and caching
    const dnsResolution = await this.resolveDomainMx(domain);

    if (dnsResolution.status === EmailValidationResultStatus.VALID_DELIVERABLE) {
      return {
        originalEmail: rawEmail,
        normalizedEmail,
        domain,
        status: EmailValidationResultStatus.VALID_DELIVERABLE,
        isDeliverableCandidate: true,
        mxRecords: dnsResolution.mxRecords,
      };
    }

    if (dnsResolution.status === EmailValidationResultStatus.DNS_TEMPORARY_ERROR) {
      return {
        originalEmail: rawEmail,
        normalizedEmail,
        domain,
        status: EmailValidationResultStatus.DNS_TEMPORARY_ERROR,
        isDeliverableCandidate: false,
        dnsError: dnsResolution.error,
        disqualificationReason: 'Temporary DNS resolution error or timeout',
      };
    }

    return {
      originalEmail: rawEmail,
      normalizedEmail,
      domain,
      status: EmailValidationResultStatus.DOMAIN_NO_MX,
      isDeliverableCandidate: false,
      dnsError: dnsResolution.error,
      disqualificationReason: `Domain "${domain}" has no active DNS MX mail exchange records`,
    };
  }

  /**
   * Resolves MX records for a domain with in-memory caching and strict timeout.
   */
  private async resolveDomainMx(domain: string): Promise<CachedDnsResolution> {
    const now = Date.now();
    const cached = this.dnsCache.get(domain);

    if (cached && now - cached.cachedAt < this.cacheTtlMs) {
      return cached;
    }

    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`DNS resolution timed out after ${this.dnsTimeoutMs}ms`));
      }, this.dnsTimeoutMs);
    });

    try {
      const records = await Promise.race([
        dns.promises.resolveMx(domain),
        timeoutPromise,
      ]).finally(() => {
        clearTimeout(timeoutHandle);
      });

      if (Array.isArray(records) && records.length > 0) {
        // Sort MX records by priority ascending
        const sortedMx = records
          .map((r) => ({ exchange: r.exchange, priority: r.priority }))
          .sort((a, b) => a.priority - b.priority);

        const result: CachedDnsResolution = {
          status: EmailValidationResultStatus.VALID_DELIVERABLE,
          mxRecords: sortedMx,
          cachedAt: now,
        };

        this.setCache(domain, result);
        return result;
      }

      const noMxResult: CachedDnsResolution = {
        status: EmailValidationResultStatus.DOMAIN_NO_MX,
        error: 'No MX records returned for domain',
        cachedAt: now,
      };
      this.setCache(domain, noMxResult);
      return noMxResult;
    } catch (err: any) {
      const errorCode = err?.code || '';
      const isTemporary =
        err.message?.includes('timed out') ||
        errorCode === 'ETIMEOUT' ||
        errorCode === 'SERVFAIL' ||
        errorCode === 'ECONNREFUSED';

      if (isTemporary) {
        return {
          status: EmailValidationResultStatus.DNS_TEMPORARY_ERROR,
          error: err.message,
          cachedAt: now,
        };
      }

      // Permanent resolution failures: ENOTFOUND, ENODATA, NODATA
      const permanentNoMx: CachedDnsResolution = {
        status: EmailValidationResultStatus.DOMAIN_NO_MX,
        error: err.message || errorCode,
        cachedAt: now,
      };
      this.setCache(domain, permanentNoMx);
      return permanentNoMx;
    }
  }

  private setCache(domain: string, resolution: CachedDnsResolution): void {
    // Keep cache bounded to 10,000 entries
    if (this.dnsCache.size >= 10000) {
      const firstKey = this.dnsCache.keys().next().value;
      if (firstKey) {
        this.dnsCache.delete(firstKey);
      }
    }
    this.dnsCache.set(domain, resolution);
  }

  /**
   * Helper to clear or reset the DNS cache (useful for testing).
   */
  clearCache(): void {
    this.dnsCache.clear();
  }
}

