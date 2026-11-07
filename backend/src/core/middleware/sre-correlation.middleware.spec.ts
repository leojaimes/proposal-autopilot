import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SreCorrelationMiddleware } from './sre-correlation.middleware';
import { Request, Response } from 'express';

describe('SreCorrelationMiddleware', () => {
  const middleware = new SreCorrelationMiddleware();

  it('debe generar traceparent y x-request-id si no vienen en la petición', () => {
    const req = {
      headers: {},
      method: 'GET',
      url: '/api/proposals',
    } as unknown as Request;

    const setHeaders: Record<string, string> = {};
    const res = {
      setHeader: (key: string, val: string) => {
        setHeaders[key] = val;
      },
      on: () => {},
    } as unknown as Response;

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    assert.equal(nextCalled, true);
    assert.ok(req.headers['x-request-id']);
    assert.match(req.headers['traceparent'] as string, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    assert.equal(setHeaders['x-request-id'], req.headers['x-request-id']);
    assert.equal(setHeaders['traceparent'], req.headers['traceparent']);
  });

  it('debe preservar el traceId original de Angular y generar un child span para NestJS', () => {
    const originalTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentSpanId = '00f067aa0ba902b7';
    const incomingTraceparent = `00-${originalTraceId}-${parentSpanId}-01`;
    const incomingRequestId = 'req-custom-12345';

    const req = {
      headers: {
        traceparent: incomingTraceparent,
        'x-request-id': incomingRequestId,
      },
      method: 'POST',
      url: '/api/config/synthesize-profile-from-cv',
    } as unknown as Request;

    const setHeaders: Record<string, string> = {};
    const res = {
      setHeader: (key: string, val: string) => {
        setHeaders[key] = val;
      },
      on: () => {},
    } as unknown as Response;

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    assert.equal(nextCalled, true);
    assert.equal(req.headers['x-request-id'], incomingRequestId);

    const childTraceparent = req.headers['traceparent'] as string;
    assert.ok(childTraceparent);

    const parts = childTraceparent.split('-');
    assert.equal(parts[1], originalTraceId); // Root traceId preserved!
    assert.notEqual(parts[2], parentSpanId); // Child spanId renewed!
    assert.equal(parts[2].length, 16);
  });
});
