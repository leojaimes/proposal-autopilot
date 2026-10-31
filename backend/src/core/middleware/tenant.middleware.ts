import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from '../context/tenant-context.service';

interface VerifiedJwtPayload {
  sub?: string;
  tenantId?: string;
  email?: string;
  role?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const path = req.originalUrl || req.url || '';
    const isPublicOrWebhookRoute =
      path.startsWith('/api/auth') ||
      path.startsWith('/api/prospecting/webhook/') ||
      path.startsWith('/api/prospecting/webhooks/') ||
      path === '/health' ||
      path === '/ready';

    const headerTenantRaw = req.headers['x-tenant-id'];
    const headerTenantId = typeof headerTenantRaw === 'string' ? headerTenantRaw.trim() : undefined;
    const authHeader = req.headers['authorization'];

    if (authHeader !== undefined && !isPublicOrWebhookRoute) {
      if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Malformed Authorization header; expected Bearer token');
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        throw new UnauthorizedException('Empty Bearer token');
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'super_secret_jwt_proposal_autopilot_2026';

      let verified: VerifiedJwtPayload;
      try {
        verified = this.jwtService.verify<VerifiedJwtPayload>(token, { secret });
      } catch {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }

      const jwtTenantId = verified.tenantId ? String(verified.tenantId).trim() : '';
      if (!jwtTenantId || !UUID_REGEX.test(jwtTenantId)) {
        throw new UnauthorizedException('Token payload is missing a valid tenantId');
      }

      // Anti-IDOR Guard: Never allow X-Tenant-Id header to override or spoof a verified JWT tenant
      if (headerTenantId && headerTenantId.toLowerCase() !== jwtTenantId.toLowerCase()) {
        throw new ForbiddenException(
          'Cross-tenant access denied: X-Tenant-Id header does not match authenticated token tenant',
        );
      }

      this.tenantContext.runWithContext(
        {
          tenantId: jwtTenantId,
          userId: verified.sub ? String(verified.sub) : undefined,
          userEmail: verified.email ? String(verified.email) : undefined,
          role: verified.role ? String(verified.role) : 'MEMBER',
          isAuthenticated: true,
        },
        async () => {
          next();
        },
      );
      return;
    }

    const enforceStrictAuth = this.configService.get<string>('ENFORCE_STRICT_AUTH') === 'true';
    if (enforceStrictAuth && !isPublicOrWebhookRoute) {
      throw new UnauthorizedException('Authentication token is required');
    }

    let resolvedTenantId =
      this.configService.get<string>('DEFAULT_TENANT_ID') || '00000000-0000-0000-0000-000000000001';

    if (headerTenantId && UUID_REGEX.test(headerTenantId)) {
      resolvedTenantId = headerTenantId;
    }

    this.tenantContext.runWithContext(
      {
        tenantId: resolvedTenantId,
        isAuthenticated: false,
      },
      async () => {
        next();
      },
    );
  }
}
