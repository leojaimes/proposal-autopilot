import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

export type WebhookSecretSource = 'LAMBDA' | 'EMAIL';
export const WEBHOOK_SOURCE_METADATA_KEY = 'prospecting:webhook_source';
export const WebhookSource = (source: WebhookSecretSource) =>
  SetMetadata(WEBHOOK_SOURCE_METADATA_KEY, source);

const HEX_SHA256_REGEX = /^[0-9a-f]{64}$/i;
const MAX_TIMESTAMP_DRIFT_SECONDS = 300; // 5 minutes anti-replay window

@Injectable()
export class HmacWebhookGuard implements CanActivate {
  private readonly logger = new Logger(HmacWebhookGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const source =
      this.reflector.get<WebhookSecretSource>(WEBHOOK_SOURCE_METADATA_KEY, context.getHandler()) ||
      'LAMBDA';

    const secret = this.resolveSecret(source);
    const rawHeader = req.headers['x-signature'];

    // Fail-closed: never allow unsigned webhook requests
    if (!rawHeader || typeof rawHeader !== 'string') {
      this.logger.warn(`Blocked unsigned ${source} webhook request (missing x-signature header)`);
      throw new UnauthorizedException('Missing x-signature HMAC header');
    }

    const normalizedSig = rawHeader.trim().replace(/^sha256=/i, '');
    if (!HEX_SHA256_REGEX.test(normalizedSig)) {
      this.logger.warn(`Blocked ${source} webhook with malformed signature format`);
      throw new UnauthorizedException('Malformed HMAC signature format');
    }

    const timestampHeader = req.headers['x-timestamp'];
    const enforceTimestamp = this.configService.get<string>('ENFORCE_WEBHOOK_TIMESTAMP') === 'true';
    if (enforceTimestamp && (!timestampHeader || typeof timestampHeader !== 'string')) {
      throw new UnauthorizedException('Missing x-timestamp header');
    }

    let validTimestampStr: string | null = null;
    if (timestampHeader && typeof timestampHeader === 'string') {
      const parsedSeconds = this.parseTimestampToEpochSeconds(timestampHeader.trim());
      if (parsedSeconds === null) {
        throw new UnauthorizedException('Invalid x-timestamp header');
      }
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSeconds - parsedSeconds) > MAX_TIMESTAMP_DRIFT_SECONDS) {
        this.logger.warn(`Blocked ${source} webhook replay attempt (timestamp outside 300s window)`);
        throw new UnauthorizedException('Webhook timestamp expired outside replay window');
      }
      validTimestampStr = timestampHeader.trim();
    }

    const rawPayloadBuffer =
      req.rawBody instanceof Buffer
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

    const providedBuffer = Buffer.from(normalizedSig, 'hex');

    // Candidate 1: HMAC(secret, rawBody) — standard Lambda payload signature
    const directDigest = createHmac('sha256', secret).update(rawPayloadBuffer).digest();
    let isValid =
      providedBuffer.length === directDigest.length && timingSafeEqual(providedBuffer, directDigest);

    // Candidate 2: HMAC(secret, `${timestamp}.${rawBody}`) — timestamp-bound signature
    if (!isValid && validTimestampStr) {
      const timestampBoundDigest = createHmac('sha256', secret)
        .update(`${validTimestampStr}.`, 'utf8')
        .update(rawPayloadBuffer)
        .digest();
      isValid =
        providedBuffer.length === timestampBoundDigest.length &&
        timingSafeEqual(providedBuffer, timestampBoundDigest);
    }

    if (!isValid) {
      this.logger.warn(`Invalid HMAC signature rejected on ${source} webhook`);
      throw new UnauthorizedException('Invalid HMAC webhook signature');
    }

    return true;
  }

  private resolveSecret(source: WebhookSecretSource): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (source === 'EMAIL') {
      const configured =
        this.configService.get<string>('EMAIL_WEBHOOK_SECRET') ||
        this.configService.get<string>('LAMBDA_WEBHOOK_SECRET');
      if (configured) return configured;
      if (isProduction) {
        throw new UnauthorizedException('EMAIL_WEBHOOK_SECRET is not configured');
      }
      return 'spotlight_email_webhook_secret_2026';
    }

    const configured = this.configService.get<string>('LAMBDA_WEBHOOK_SECRET');
    if (configured) return configured;
    if (isProduction) {
      throw new UnauthorizedException('LAMBDA_WEBHOOK_SECRET is not configured');
    }
    return 'spotlight_visual_scraper_secret_2026';
  }

  private parseTimestampToEpochSeconds(value: string): number | null {
    if (/^\d+$/.test(value)) {
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      // Handle milliseconds if 13+ digits
      return num > 1e12 ? Math.floor(num / 1000) : num;
    }
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  }
}

