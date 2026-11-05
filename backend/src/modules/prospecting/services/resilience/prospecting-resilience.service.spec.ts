import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ProspectingResilienceService,
  ProspectingProviderPort,
  ProspectingScanOptions,
} from './prospecting-resilience.service';
import { CircuitState } from './prospecting-circuit-breaker';

describe('ProspectingResilienceService (node:test)', () => {
  it('should execute providers in the exact order declared in fallback chain', async () => {
    const callLog: string[] = [];

    const mockLambda: ProspectingProviderPort = {
      id: 'LAMBDA',
      isReady: true,
      search: async () => {
        callLog.push('LAMBDA');
        return []; // 0 results -> triggers next fallback
      },
    };

    const mockPlaces: ProspectingProviderPort = {
      id: 'PLACES_API',
      isReady: true,
      search: async () => {
        callLog.push('PLACES_API');
        return [{ placeId: 'place-1', name: 'Real Place' }];
      },
    };

    const service = new ProspectingResilienceService([mockLambda, mockPlaces], {
      fallbackChain: 'LAMBDA,PLACES_API',
    });

    const result = await service.executeScan({ query: 'dentistas' });

    assert.equal(result.resolvedBy, 'PLACES_API');
    assert.deepEqual(result.leads, [{ placeId: 'place-1', name: 'Real Place' }]);
    assert.deepEqual(callLog, ['LAMBDA', 'PLACES_API']);
  });

  it('should abort hanging provider when per-provider timeout is exceeded and switch to next provider', async () => {
    let lambdaAborted = false;

    const mockHangingLambda: ProspectingProviderPort = {
      id: 'LAMBDA',
      isReady: true,
      search: async (opts) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve([{ placeId: 'late' }]), 500);
          opts.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            lambdaAborted = true;
          });
        });
      },
    };

    const mockPlaces: ProspectingProviderPort = {
      id: 'PLACES_API',
      isReady: true,
      search: async () => [{ placeId: 'places-fast', name: 'Fast Clinic' }],
    };

    const service = new ProspectingResilienceService([mockHangingLambda, mockPlaces], {
      fallbackChain: 'LAMBDA,PLACES_API',
      timeouts: { LAMBDA: 50, PLACES_API: 500 }, // 50ms timeout for Lambda
    });

    const start = performance.now();
    const result = await service.executeScan({ query: 'clinicas' });
    const duration = performance.now() - start;

    assert.equal(result.resolvedBy, 'PLACES_API');
    assert.equal(result.leads[0].placeId, 'places-fast');
    assert.equal(lambdaAborted, true);
    assert.ok(duration < 250, `Expected scan to finish quickly, took ${duration}ms`);
  });

  it('should immediately skip provider if its circuit breaker is in OPEN state (0ms delay)', async () => {
    let lambdaCalls = 0;

    const mockFailingLambda: ProspectingProviderPort = {
      id: 'LAMBDA',
      isReady: true,
      search: async () => {
        lambdaCalls++;
        throw new Error('Cloudflare Challenge 403');
      },
    };

    const mockPlaces: ProspectingProviderPort = {
      id: 'PLACES_API',
      isReady: true,
      search: async () => [{ placeId: 'places-ok' }],
    };

    const service = new ProspectingResilienceService([mockFailingLambda, mockPlaces], {
      fallbackChain: 'LAMBDA,PLACES_API',
    });

    // Cause 3 failures to trip Lambda's circuit breaker to OPEN
    await service.executeScan({ query: 'test' });
    await service.executeScan({ query: 'test' });
    await service.executeScan({ query: 'test' });

    assert.equal(service.getCircuitState('LAMBDA'), CircuitState.OPEN);
    assert.equal(lambdaCalls, 3);

    // 4th scan: Lambda must be fast-skipped without invoking search()
    const result = await service.executeScan({ query: 'test' });
    assert.equal(result.resolvedBy, 'PLACES_API');
    assert.equal(lambdaCalls, 3); // Not incremented!
  });

  it('should emit transition events during failover with provider telemetry', async () => {
    const transitions: Array<{ fromProvider: string; toProvider?: string; reason: string }> = [];

    const mockLambda: ProspectingProviderPort = {
      id: 'LAMBDA',
      isReady: true,
      search: async () => { throw new Error('Lambda WAF block'); },
    };

    const mockSynthetic: ProspectingProviderPort = {
      id: 'SYNTHETIC',
      isReady: true,
      search: async () => [{ placeId: 'synth-1' }],
    };

    const service = new ProspectingResilienceService([mockLambda, mockSynthetic], {
      fallbackChain: 'LAMBDA,SYNTHETIC',
      onTransition: (evt) => transitions.push(evt),
    });

    const result = await service.executeScan({ query: 'test' });
    assert.equal(result.resolvedBy, 'SYNTHETIC');
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].fromProvider, 'LAMBDA');
    assert.equal(transitions[0].toProvider, 'SYNTHETIC');
  });
});
