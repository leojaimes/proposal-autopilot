import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface UrlSafetyValidationResult {
  isSafe: boolean;
  normalizedUrl?: string;
  rootDomain?: string;
  isSocialOrDirectory?: boolean;
  reason?: string;
}

const SOCIAL_AND_DIRECTORY_DOMAINS = new Set([
  'facebook.com',
  'fb.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'wa.me',
  'whatsapp.com',
  'linktr.ee',
  'bit.ly',
  'doctoralia.com.mx',
  'doctoralia.co',
  'topdoctors.mx',
  'topdoctors.com.co',
  'tripadvisor.com',
  'tripadvisor.com.mx',
  'yelp.com',
  'google.com',
  'maps.app.goo.gl',
  'goo.gl',
]);

const MULTI_PART_TLDS = new Set([
  'com.mx',
  'org.mx',
  'gob.mx',
  'edu.mx',
  'net.mx',
  'com.co',
  'org.co',
  'edu.co',
  'gov.co',
  'net.co',
  'co.uk',
  'com.ar',
  'com.br',
  'com.pe',
  'com.cl',
]);

export function extractRegistrableRootDomain(hostname: string): string | undefined {
  const cleanHost = hostname.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!cleanHost || isIP(cleanHost) !== 0 || !cleanHost.includes('.')) {
    return undefined;
  }

  const parts = cleanHost.split('.');
  if (parts.length <= 2) {
    return cleanHost;
  }

  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }

  return lastTwo;
}

export function isSocialOrDirectoryDomain(rootDomain?: string): boolean {
  if (!rootDomain) return false;
  return SOCIAL_AND_DIRECTORY_DOMAINS.has(rootDomain.toLowerCase());
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');

  // IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1 or ::ffff:169.254.169.254
  if (cleanIp.startsWith('::ffff:')) {
    const mappedV4 = cleanIp.slice(7);
    if (isIP(mappedV4) === 4) {
      return isPrivateOrReservedIp(mappedV4);
    }
  }

  const version = isIP(cleanIp);
  if (version === 4) {
    const octets = cleanIp.split('.').map((n) => Number(n));
    if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
      return true;
    }
    const [a, b] = octets;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 Loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 Link-local & Cloud IMDS
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 Benchmark
    if (a >= 224) return true; // Multicast & Reserved
    return false;
  }

  if (version === 6) {
    if (cleanIp === '::' || cleanIp === '::1') return true; // Unspecified / Loopback
    if (cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
      return true; // fe80::/10 Link-local
    }
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return true; // fc00::/7 Unique local
    }
    return false;
  }

  return true;
}

export function validateExternalBusinessUrlSync(rawUrl?: string | null): UrlSafetyValidationResult {
  if (!rawUrl || !rawUrl.trim()) {
    return { isSafe: false, reason: 'EMPTY_URL' };
  }

  let candidate = rawUrl.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { isSafe: false, reason: 'INVALID_URL_FORMAT' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isSafe: false, reason: 'SSRF_BLOCKED_PROTOCOL' };
  }

  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: 'SSRF_BLOCKED_CREDENTIALS_IN_URL' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa') ||
    !hostname.includes('.')
  ) {
    return { isSafe: false, reason: 'SSRF_BLOCKED_INTERNAL_HOST' };
  }

  if (isIP(hostname) !== 0 && isPrivateOrReservedIp(hostname)) {
    return { isSafe: false, reason: 'SSRF_BLOCKED_PRIVATE_IP' };
  }

  const rootDomain = extractRegistrableRootDomain(hostname);
  const social = isSocialOrDirectoryDomain(rootDomain);

  return {
    isSafe: true,
    normalizedUrl: parsed.toString(),
    rootDomain,
    isSocialOrDirectory: social,
  };
}

export async function validateExternalBusinessUrlWithDns(
  rawUrl?: string | null,
): Promise<UrlSafetyValidationResult> {
  const syncCheck = validateExternalBusinessUrlSync(rawUrl);
  if (!syncCheck.isSafe || !syncCheck.normalizedUrl) {
    return syncCheck;
  }

  const parsed = new URL(syncCheck.normalizedUrl);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname) !== 0) {
    return syncCheck;
  }

  try {
    const records = await lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return {
        ...syncCheck,
        isSafe: false,
        reason: 'DNS_NXDOMAIN',
      };
    }

    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          ...syncCheck,
          isSafe: false,
          reason: 'SSRF_BLOCKED_DNS_REBINDING_PRIVATE_IP',
        };
      }
    }

    return syncCheck;
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'ENOTFOUND' || code === 'EAI_NONAME' || code === 'ENODATA') {
      return {
        ...syncCheck,
        isSafe: false,
        reason: 'DNS_NXDOMAIN',
      };
    }
    return {
      ...syncCheck,
      isSafe: false,
      reason: `DNS_LOOKUP_FAILED:${code || 'UNKNOWN'}`,
    };
  }
}

