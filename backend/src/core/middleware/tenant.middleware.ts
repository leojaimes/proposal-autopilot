import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from '../context/tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extracción de header x-tenant-id o fallback resiliente (evita lockouts)
    const rawTenantId = req.headers['x-tenant-id'] as string;
    const tenantId = rawTenantId && rawTenantId.trim().length > 0 
      ? rawTenantId.trim() 
      : (process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001');

    this.tenantContext.runWithTenant(tenantId, async () => {
      next();
    });
  }
}
