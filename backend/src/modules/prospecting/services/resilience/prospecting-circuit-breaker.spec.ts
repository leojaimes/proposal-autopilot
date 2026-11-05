import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ProspectingCircuitBreaker,
  CircuitState,
} from './prospecting-circuit-breaker';

describe('ProspectingCircuitBreaker (node:test)', () => {
  it('should initialize in CLOSED state and record successful executions without opening', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'LAMBDA',
      windowSize: 20,
      failureThresholdRatio: 0.5,
      consecutiveSevereThreshold: 3,
      cooldownMs: 1000,
    });

    assert.equal(cb.state, CircuitState.CLOSED);
    assert.equal(cb.isCallAllowed(), true);

    const result = await cb.execute(async () => {
      return ['lead-1', 'lead-2'];
    });

    assert.deepEqual(result, ['lead-1', 'lead-2']);
    assert.equal(cb.state, CircuitState.CLOSED);
    assert.equal(cb.stats.consecutiveFailures, 0);
  });

  it('should open circuit immediately when 3 consecutive severe transient errors occur (timeout/403/429)', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'LAMBDA',
      consecutiveSevereThreshold: 3,
      cooldownMs: 5000,
    });

    const failingFn = async () => {
      throw new Error('ETIMEDOUT connection failed');
    };

    // First 2 failures: still CLOSED
    await assert.rejects(cb.execute(failingFn));
    assert.equal(cb.state, CircuitState.CLOSED);

    await assert.rejects(cb.execute(failingFn));
    assert.equal(cb.state, CircuitState.CLOSED);

    // 3rd failure: transitions to OPEN
    await assert.rejects(cb.execute(failingFn));
    assert.equal(cb.state, CircuitState.OPEN);
    assert.equal(cb.isCallAllowed(), false);
  });

  it('should fast-reject execution with 0ms delay when circuit state is OPEN', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'LAMBDA',
      consecutiveSevereThreshold: 1,
      cooldownMs: 60000,
    });

    await assert.rejects(cb.execute(async () => { throw new Error('Crash'); }));
    assert.equal(cb.state, CircuitState.OPEN);

    let functionCalled = false;
    const start = performance.now();

    await assert.rejects(
      cb.execute(async () => {
        functionCalled = true;
        return 'never';
      }),
      (err: any) => err.name === 'CircuitBreakerOpenError',
    );

    const elapsed = performance.now() - start;
    assert.equal(functionCalled, false);
    assert.ok(elapsed < 20, `Expected fast-reject in <20ms, took ${elapsed}ms`);
  });

  it('should transition to HALF_OPEN after cooldown and allow only 1 pilot probe while rejecting concurrent calls', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'PLACES_API',
      consecutiveSevereThreshold: 1,
      cooldownMs: 50, // Short cooldown for testing
    });

    await assert.rejects(cb.execute(async () => { throw new Error('Outage'); }));
    assert.equal(cb.state, CircuitState.OPEN);

    // Wait past cooldown
    await new Promise((r) => setTimeout(r, 60));

    // Calling isCallAllowed should evaluate cooldown and transition to HALF_OPEN
    assert.equal(cb.state, CircuitState.HALF_OPEN);
    assert.equal(cb.isCallAllowed(), true);

    // Pilot probe in flight
    let probeExecuted = false;
    const probePromise = cb.execute(async () => {
      await new Promise((r) => setTimeout(r, 40));
      probeExecuted = true;
      return 'recovered';
    });

    // Concurrent call during probe must be rejected to prevent thundering herd
    await assert.rejects(
      cb.execute(async () => 'concurrent-call'),
      (err: any) => err.name === 'CircuitBreakerOpenError',
    );

    const probeResult = await probePromise;
    assert.equal(probeResult, 'recovered');
    assert.equal(probeExecuted, true);
    assert.equal(cb.state, CircuitState.CLOSED);
  });

  it('should open circuit when sliding window error rate exceeds 50% across samples', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'OVERPASS',
      windowSize: 10,
      failureThresholdRatio: 0.5,
      consecutiveSevereThreshold: 10, // High so only sliding window triggers it
      cooldownMs: 60000,
    });

    // Send 3 successes, then 4 failures: 4/7 = 57% error rate (> 50%)
    await cb.execute(async () => 'ok');
    await cb.execute(async () => 'ok');
    await cb.execute(async () => 'ok');

    assert.equal(cb.state, CircuitState.CLOSED);

    // Failures
    await assert.rejects(cb.execute(async () => { throw new Error('Fail 1'); }));
    await assert.rejects(cb.execute(async () => { throw new Error('Fail 2'); }));
    await assert.rejects(cb.execute(async () => { throw new Error('Fail 3'); }));

    // Still under 50% (3/6 = 50%)
    assert.equal(cb.stats.windowSamples, 6);

    // 4th failure: 4/7 = 57.1% (> 50% threshold) -> transitions to OPEN
    await assert.rejects(cb.execute(async () => { throw new Error('Fail 4'); }));
    assert.equal(cb.state, CircuitState.OPEN);
    assert.equal(cb.isCallAllowed(), false);
  });

  it('should not count empty non-transient business responses as circuit failures', async () => {
    const cb = new ProspectingCircuitBreaker({
      providerId: 'PLACES_API',
      consecutiveSevereThreshold: 2,
    });

    // Business response that returned empty array (not a transient infra crash)
    const emptyResult = await cb.execute(async () => []);
    assert.deepEqual(emptyResult, []);

    const emptyResult2 = await cb.execute(async () => []);
    assert.deepEqual(emptyResult2, []);

    // State must remain CLOSED
    assert.equal(cb.state, CircuitState.CLOSED);
    assert.equal(cb.stats.consecutiveFailures, 0);
  });
});
