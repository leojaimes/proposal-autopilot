import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Parses and generates RFC-compliant W3C Trace Context and Request ID correlation
 */
@Injectable()
export class SreCorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SreCorrelation');

  use(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();

    // 1. Correlación de X-Request-Id
    const incomingRequestId = req.headers['x-request-id'];
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim()
        ? incomingRequestId.trim()
        : randomUUID();

    // 2. Correlación W3C Traceparent
    const incomingTraceparent = req.headers['traceparent'];
    let traceId: string;
    let spanId: string;

    if (
      typeof incomingTraceparent === 'string' &&
      /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(incomingTraceparent.trim())
    ) {
      const parts = incomingTraceparent.trim().split('-');
      traceId = parts[1];
      spanId = randomBytes(8).toString('hex'); // Child span for NestJS tier
    } else {
      traceId = randomBytes(16).toString('hex');
      spanId = randomBytes(8).toString('hex');
    }

    const currentTraceparent = `00-${traceId}-${spanId}-01`;

    // 3. Inyectar en Request y Response headers
    req.headers['x-request-id'] = requestId;
    req.headers['traceparent'] = currentTraceparent;
    res.setHeader('x-request-id', requestId);
    res.setHeader('traceparent', currentTraceparent);

    // 4. Log estructurado de finalización de petición
    res.on('finish', () => {
      const durationMs = (performance.now() - start).toFixed(2);
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl || req.url;

      if (statusCode >= 500) {
        this.logger.error(
          `[${method}] ${url} -> HTTP ${statusCode} (${durationMs}ms) | traceId: ${traceId} | requestId: ${requestId}`
        );
      } else if (statusCode >= 400) {
        this.logger.warn(
          `[${method}] ${url} -> HTTP ${statusCode} (${durationMs}ms) | traceId: ${traceId} | requestId: ${requestId}`
        );
      }
    });

    next();
  }
}
