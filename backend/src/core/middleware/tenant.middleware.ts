import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from '../context/tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extracción de header x-tenant-id o JWT Bearer token o fallback resiliente (evita lockouts)
    let tenantId = (req.headers['x-tenant-id'] as string)?.trim();

    if (!tenantId && req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload && payload.tenantId) {
              tenantId = String(payload.tenantId).trim();
            }
          }
        } catch {
          // Si el parseo falla, continúa hacia el fallback seguro
        }
      }
    }

    if (!tenantId) {
      tenantId = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
    }

    this.tenantContext.runWithTenant(tenantId, async () => {
      next();
    });
  }
}
