import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * SRE Telemetry & Ingress Resilience Interceptor
 * 
 * 1. Attaches correlation tracing headers (X-Request-Id) to every outgoing HTTP request.
 * 2. Normalizes non-JSON proxy/HTML gateway failures (413, 502, 504, 500) into structured
 *    JSON error objects so client components never crash on JSON.parse / Unexpected token '<'.
 */
export const sreTelemetryInterceptor: HttpInterceptorFn = (req, next) => {
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const modifiedReq = req.clone({
    setHeaders: {
      'X-Request-Id': requestId,
    },
  });

  return next(modifiedReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // Detect raw HTML error bodies emitted by edge reverse proxies / CDNs
        const isHtmlBody =
          typeof err.error === 'string' &&
          (err.error.startsWith('<!DOCTYPE') ||
            err.error.startsWith('<html') ||
            err.error.includes('<head>') ||
            err.error.includes('<body'));

        if (isHtmlBody) {
          const fallbackMessage =
            err.status === 413
              ? 'El archivo o contenido subido supera el límite permitido por el servidor (máx. 25MB).'
              : err.status === 502 || err.status === 504
              ? 'El servicio no está respondiendo a tiempo (Gateway Timeout / Bad Gateway).'
              : `Error del servidor (${err.status}): Respuesta no válida del gateway.`;

          const normalizedError = new HttpErrorResponse({
            error: {
              error: 'INGRESS_OR_GATEWAY_ERROR',
              status: err.status,
              code: err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'GATEWAY_ERROR',
              message: fallbackMessage,
              requestId,
            },
            headers: err.headers,
            status: err.status,
            statusText: err.statusText,
            url: err.url || req.url,
          });

          return throwError(() => normalizedError);
        }
      }
      return throwError(() => err);
    })
  );
};
