import { Injectable } from '@nestjs/common';
import { PhoneLineType } from '@prisma/client';

export interface NormalizedPhoneResult {
  raw?: string;
  phoneE164: string | null;
  whatsappDigits: string | null;
  phoneType: PhoneLineType;
  hasExtension: boolean;
}

const EXTENSION_REGEX = /\b(?:ext\.?|extension|x)\s*\d+/i;
const NANP_TOLL_FREE = new Set(['800', '888', '877', '866', '855', '844', '833']);

@Injectable()
export class PhoneNormalizerService {
  normalize(rawPhone?: string | null, countryHint: string = 'Mexico'): NormalizedPhoneResult {
    if (!rawPhone || !rawPhone.trim()) {
      return {
        raw: rawPhone ?? undefined,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.UNKNOWN,
        hasExtension: false,
      };
    }

    const hasExtension = EXTENSION_REGEX.test(rawPhone);
    const withoutExtension = rawPhone.replace(EXTENSION_REGEX, '').trim();
    const digitsOnly = withoutExtension.replace(/\D/g, '');

    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return {
        raw: rawPhone,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.INVALID,
        hasExtension,
      };
    }

    const countryUpper = (countryHint || 'MEXICO').trim().toUpperCase();
    const isColombia = countryUpper === 'CO' || countryUpper.includes('COLOMBIA') || withoutExtension.startsWith('+57');
    const isUsa =
      countryUpper === 'US' ||
      countryUpper === 'USA' ||
      countryUpper.includes('UNITED STATES') ||
      (withoutExtension.startsWith('+1') && !withoutExtension.startsWith('+52'));

    if (isColombia) {
      return this.normalizeColombia(rawPhone, digitsOnly, hasExtension);
    }

    if (isUsa) {
      return this.normalizeUsa(rawPhone, digitsOnly, hasExtension);
    }

    return this.normalizeMexico(rawPhone, digitsOnly, hasExtension);
  }

  private normalizeMexico(
    raw: string,
    digits: string,
    hasExtension: boolean,
  ): NormalizedPhoneResult {
    let national = digits;

    // Strip legacy domestic prefixes (01, 044, 045)
    if (national.startsWith('044') || national.startsWith('045')) {
      national = national.slice(3);
    } else if (national.startsWith('01') && national.length === 12) {
      national = national.slice(2);
    }

    // Strip country code +52 and legacy mobile '1' (+52 1 XXX XXX XXXX -> 10 digits)
    if (national.startsWith('521') && national.length === 13) {
      national = national.slice(3);
    } else if (national.startsWith('52') && national.length === 12) {
      national = national.slice(2);
    }

    if (national.length !== 10) {
      return {
        raw,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.INVALID,
        hasExtension,
      };
    }

    const phoneE164 = `+52${national}`;
    const isTollFree = national.startsWith('800') || national.startsWith('900');

    // Switchboards with extensions, toll-free prefixes, or '0000' PBX endings are landlines
    if (hasExtension || isTollFree || national.endsWith('0000')) {
      return {
        raw,
        phoneE164,
        whatsappDigits: null,
        phoneType: PhoneLineType.LANDLINE,
        hasExtension,
      };
    }

    return {
      raw,
      phoneE164,
      whatsappDigits: `52${national}`,
      phoneType: PhoneLineType.MOBILE,
      hasExtension: false,
    };
  }

  private normalizeColombia(
    raw: string,
    digits: string,
    hasExtension: boolean,
  ): NormalizedPhoneResult {
    let national = digits;
    if (national.startsWith('57') && national.length === 12) {
      national = national.slice(2);
    } else if (national.startsWith('018000')) {
      return {
        raw,
        phoneE164: `+57${national}`,
        whatsappDigits: null,
        phoneType: PhoneLineType.LANDLINE,
        hasExtension,
      };
    }

    // 7-digit legacy local landline
    if (national.length === 7) {
      return {
        raw,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.LANDLINE,
        hasExtension,
      };
    }

    if (national.length !== 10) {
      return {
        raw,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.INVALID,
        hasExtension,
      };
    }

    const phoneE164 = `+57${national}`;

    // In Colombia: 3XX XXX XXXX is strictly mobile; 60X XXX XXXX is fixed landline
    if (national.startsWith('60') || hasExtension) {
      return {
        raw,
        phoneE164,
        whatsappDigits: null,
        phoneType: PhoneLineType.LANDLINE,
        hasExtension,
      };
    }

    if (national.startsWith('3')) {
      return {
        raw,
        phoneE164,
        whatsappDigits: `57${national}`,
        phoneType: PhoneLineType.MOBILE,
        hasExtension: false,
      };
    }

    return {
      raw,
      phoneE164,
      whatsappDigits: null,
      phoneType: PhoneLineType.UNKNOWN,
      hasExtension,
    };
  }

  private normalizeUsa(
    raw: string,
    digits: string,
    hasExtension: boolean,
  ): NormalizedPhoneResult {
    let national = digits;
    if (national.startsWith('1') && national.length === 11) {
      national = national.slice(1);
    }

    if (national.length !== 10) {
      return {
        raw,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.INVALID,
        hasExtension,
      };
    }

    const areaCode = national.slice(0, 3);
    const exchange = national.slice(3, 6);
    if (areaCode[0] === '0' || areaCode[0] === '1' || exchange[0] === '0' || exchange[0] === '1') {
      return {
        raw,
        phoneE164: null,
        whatsappDigits: null,
        phoneType: PhoneLineType.INVALID,
        hasExtension,
      };
    }

    const phoneE164 = `+1${national}`;
    if (hasExtension || NANP_TOLL_FREE.has(areaCode) || national.endsWith('0000')) {
      return {
        raw,
        phoneE164,
        whatsappDigits: null,
        phoneType: PhoneLineType.LANDLINE,
        hasExtension,
      };
    }

    return {
      raw,
      phoneE164,
      whatsappDigits: `1${national}`,
      phoneType: PhoneLineType.MOBILE,
      hasExtension: false,
    };
  }
}

