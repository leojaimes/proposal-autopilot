import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  role?: string;
  isAuthenticated?: boolean;
}

const DEFAULT_FALLBACK_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return TenantContextService.storage.run({ tenantId, isAuthenticated: false }, fn);
  }

  runWithContext<T>(context: TenantStore, fn: () => Promise<T>): Promise<T> {
    return TenantContextService.storage.run(context, fn);
  }

  getStore(): TenantStore | undefined {
    return TenantContextService.storage.getStore();
  }

  getTenantId(): string {
    const store = TenantContextService.storage.getStore();
    return store?.tenantId || process.env.DEFAULT_TENANT_ID || DEFAULT_FALLBACK_TENANT_ID;
  }

  getUserId(): string | undefined {
    return TenantContextService.storage.getStore()?.userId;
  }

  getUserEmail(): string | undefined {
    return TenantContextService.storage.getStore()?.userEmail;
  }

  getUserRole(): string | undefined {
    return TenantContextService.storage.getStore()?.role;
  }

  isAuthenticated(): boolean {
    return Boolean(TenantContextService.storage.getStore()?.isAuthenticated);
  }
}
