export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  providerId: string;
  windowSize?: number;
  failureThresholdRatio?: number;
  consecutiveSevereThreshold?: number;
  cooldownMs?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly providerId: string) {
    super(`Circuit breaker for provider "${providerId}" is OPEN.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class ProspectingCircuitBreaker {
  readonly providerId: string;
  private readonly consecutiveSevereThreshold: number;
  private readonly cooldownMs: number;
  private readonly windowSize: number;
  private readonly failureThresholdRatio: number;
  private readonly ringBuffer: number[] = [];
  private _state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private totalSuccesses = 0;
  private lastStateChangedAt: number = Date.now();
  private isProbeInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    this.providerId = options.providerId;
    this.consecutiveSevereThreshold = options.consecutiveSevereThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 10 * 60 * 1000;
    this.windowSize = options.windowSize ?? 20;
    this.failureThresholdRatio = options.failureThresholdRatio ?? 0.5;
  }

  get state(): CircuitState {
    this.checkCooldownTransition();
    return this._state;
  }

  get stats() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      totalSuccesses: this.totalSuccesses,
      state: this.state,
      windowSamples: this.ringBuffer.length,
      windowFailureRate: this.calculateFailureRate(),
    };
  }

  private calculateFailureRate(): number {
    if (this.ringBuffer.length === 0) return 0;
    const failures = this.ringBuffer.reduce((acc, val) => acc + val, 0);
    return failures / this.ringBuffer.length;
  }

  private recordSample(isFailure: boolean) {
    if (this.ringBuffer.length >= this.windowSize) {
      this.ringBuffer.shift();
    }
    this.ringBuffer.push(isFailure ? 1 : 0);

    const minSamplesForThreshold = Math.min(this.windowSize, 5);
    if (
      this.ringBuffer.length >= minSamplesForThreshold &&
      this.calculateFailureRate() >= this.failureThresholdRatio
    ) {
      this._state = CircuitState.OPEN;
      this.lastStateChangedAt = Date.now();
    }
  }

  private checkCooldownTransition() {
    if (
      this._state === CircuitState.OPEN &&
      Date.now() - this.lastStateChangedAt >= this.cooldownMs
    ) {
      this._state = CircuitState.HALF_OPEN;
      this.isProbeInFlight = false;
      this.lastStateChangedAt = Date.now();
    }
  }

  isCallAllowed(): boolean {
    this.checkCooldownTransition();
    if (this._state === CircuitState.CLOSED) return true;
    if (this._state === CircuitState.HALF_OPEN) return !this.isProbeInFlight;
    return false;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isCallAllowed()) {
      throw new CircuitBreakerOpenError(this.providerId);
    }

    if (this._state === CircuitState.HALF_OPEN) {
      this.isProbeInFlight = true;
    }

    try {
      const result = await fn();
      if (this._state === CircuitState.HALF_OPEN) {
        this._state = CircuitState.CLOSED;
        this.lastStateChangedAt = Date.now();
      }
      this.consecutiveFailures = 0;
      this.isProbeInFlight = false;
      this.totalSuccesses++;
      this.recordSample(false);
      return result;
    } catch (err) {
      this.consecutiveFailures++;
      this.isProbeInFlight = false;
      this.recordSample(true);

      if (
        this._state === CircuitState.HALF_OPEN ||
        this.consecutiveFailures >= this.consecutiveSevereThreshold
      ) {
        this._state = CircuitState.OPEN;
        this.lastStateChangedAt = Date.now();
      }
      throw err;
    }
  }
}
