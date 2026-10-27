import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const tenant = auth.currentTenant();

  const headersToAdd: Record<string, string> = {};

  if (token) {
    headersToAdd['Authorization'] = `Bearer ${token}`;
  }

  if (tenant?.id) {
    headersToAdd['X-Tenant-Id'] = tenant.id;
  }

  if (Object.keys(headersToAdd).length > 0) {
    return next(req.clone({ setHeaders: headersToAdd }));
  }

  return next(req);
};
