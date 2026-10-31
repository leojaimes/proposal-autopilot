import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../context/tenant-context.service';

const PRIVILEGED_ROLES = new Set(['OWNER', 'ADMIN', 'SUPERADMIN']);

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.tenantContext.isAuthenticated()) {
      throw new ForbiddenException('Admin authentication is required to modify catalog policies');
    }

    const role = (this.tenantContext.getUserRole() || '').toUpperCase();
    if (!PRIVILEGED_ROLES.has(role)) {
      throw new ForbiddenException('Insufficient permissions: OWNER or ADMIN role required');
    }

    return true;
  }
}

