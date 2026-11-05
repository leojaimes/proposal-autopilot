import { Injectable, Logger } from '@nestjs/common';
import {
  ProspectingCircuitBreaker,
  CircuitState,
} from './prospecting-circuit-breaker';

export interface ProspectingScanOptions {
  query: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  city?: string;
  state?: string;
  country?: string;
  polygon?: Array<{ lat: number; lng: number }>;
  limit?: number;
  scanId?: string;
  tenantId?: string;
  signal?: AbortSignal;
}

export interface ProspectingProviderPort {
  readonly id: string;
  readonly isReady: boolean;
  search(options: ProspectingScanOptions): Promise<any[]>;
}

export interface ProspectingResilienceOptions {
  fallbackChain?: string;
  timeouts?: Record<string, number>;
  onTransition?: (event: {
    fromProvider: string;
    toProvider?: string;
    reason: string;
  }) => void;
}

export interface ProspectingScanResult {
  leads: any[];
  resolvedBy: string;
  totalAttempted: number;
  latencyMs: number;
  circuitBreakerStates: Record<string, CircuitState>;
}

const DEFAULT_TIMEOUTS: Record<string, number> = {
  LAMBDA: 2500,
  PLACES_API: 1500,
  OVERPASS: 3000,
  SYNTHETIC: 50,
};

@Injectable()
export class ProspectingResilienceService {
  private readonly logger = new Logger(ProspectingResilienceService.name);
  private readonly providersMap = new Map<string, ProspectingProviderPort>();
  private readonly circuitBreakers = new Map<string, ProspectingCircuitBreaker>();
  private readonly fallbackChain: string[];
  private readonly timeouts: Record<string, number>;
  private readonly onTransition?: (event: {
    fromProvider: string;
    toProvider?: string;
    reason: string;
  }) => void;

  constructor(
    providers: ProspectingProviderPort[] = [],
    options?: ProspectingResilienceOptions,
  ) {
    for (const provider of providers) {
      this.providersMap.set(provider.id.toUpperCase(), provider);
      this.circuitBreakers.set(
        provider.id.toUpperCase(),
        new ProspectingCircuitBreaker({ providerId: provider.id.toUpperCase() }),
      );
    }

    const rawChain =
      options?.fallbackChain ||
      process.env.PROSPECTING_FALLBACK_CHAIN ||
      'LAMBDA,PLACES_API,SYNTHETIC';

    this.fallbackChain = rawChain
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options?.timeouts };
    this.onTransition = options?.onTransition;
  }

  getCircuitState(providerId: string): CircuitState {
    return this.circuitBreakers.get(providerId.toUpperCase())?.state ?? CircuitState.CLOSED;
  }

  async executeScan(options: ProspectingScanOptions): Promise<ProspectingScanResult> {
    const startTime = performance.now();
    let totalAttempted = 0;

    for (let i = 0; i < this.fallbackChain.length; i++) {
      const providerId = this.fallbackChain[i];
      const provider = this.providersMap.get(providerId);

      if (!provider || !provider.isReady) {
        continue;
      }

      const cb = this.circuitBreakers.get(providerId);
      if (cb && !cb.isCallAllowed()) {
        const nextProvider = this.fallbackChain[i + 1];
        this.logger.warn(`[CircuitBreaker] Provider ${providerId} is OPEN. Fast-skipping to ${nextProvider || 'NONE'}.`);
        this.onTransition?.({
          fromProvider: providerId,
          toProvider: nextProvider,
          reason: `Circuit Breaker OPEN`,
        });
        continue;
      }

      totalAttempted++;
      const timeoutMs = this.timeouts[providerId] || 2500;

      try {
        const leads = await this.executeWithTimeout(
          providerId,
          (signal) => provider.search({ ...options, signal }),
          timeoutMs,
          cb,
        );

        if (leads && leads.length > 0) {
          const latencyMs = Math.round(performance.now() - startTime);
          this.logger.log(`[Resilience] Provider ${providerId} successfully resolved ${leads.length} leads in ${latencyMs}ms.`);
          return {
            leads,
            resolvedBy: providerId,
            totalAttempted,
            latencyMs,
            circuitBreakerStates: this.getAllCircuitStates(),
          };
        }

        const nextProvider = this.fallbackChain[i + 1];
        this.logger.warn(`[Resilience] Provider ${providerId} returned 0 results. Transitioning to ${nextProvider || 'NONE'}.`);
        this.onTransition?.({
          fromProvider: providerId,
          toProvider: nextProvider,
          reason: '0 results returned',
        });
      } catch (err: any) {
        const nextProvider = this.fallbackChain[i + 1];
        this.logger.warn(`[Resilience] Provider ${providerId} failed (${err.message}). Transitioning to ${nextProvider || 'NONE'}.`);
        this.onTransition?.({
          fromProvider: providerId,
          toProvider: nextProvider,
          reason: err.message,
        });
      }
    }

    return {
      leads: [],
      resolvedBy: 'NONE',
      totalAttempted,
      latencyMs: Math.round(performance.now() - startTime),
      circuitBreakerStates: this.getAllCircuitStates(),
    };
  }

  private async executeWithTimeout<T>(
    providerId: string,
    action: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    cb?: ProspectingCircuitBreaker,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Provider "${providerId}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const execution = async () => {
      try {
        const result = await Promise.race([action(controller.signal), timeoutPromise]);
        return result;
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    if (cb) {
      return cb.execute(execution);
    }
    return execution();
  }

  private getAllCircuitStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [id, cb] of this.circuitBreakers.entries()) {
      states[id] = cb.state;
    }
    return states;
  }
}

