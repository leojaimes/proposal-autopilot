import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string;
}

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return TenantContextService.storage.run({ tenantId }, fn);
  }

  getTenantId(): string {
    const store = TenantContextService.storage.getStore();
    return store?.tenantId || process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
  }
}
