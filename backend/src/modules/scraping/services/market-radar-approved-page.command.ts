import { MarketRadarGapPlan } from './market-radar-gap-plan.service';
import { MarketRadarSegment } from './market-radar-coverage-window';

type HistoricalPageWorkflow = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    inputCursor: string | null;
    postFilterText: string | null;
    maxTotalChargeUsd: number;
  }): Promise<unknown>;
};

export class MarketRadarApprovedPageCommand {
  constructor(private readonly workflow: HistoricalPageWorkflow) {}

  async execute(input: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    postFilterText: string | null;
    plan: MarketRadarGapPlan;
  }): Promise<unknown> {
    if (input.plan.state === 'covered') return { state: 'covered' };

    if (!input.plan.actorInput || input.plan.maxItems == null) {
      throw new Error('approved gap plan must include actor input and max items');
    }

    try {
      return await this.workflow.execute({
        coverageWindowId: input.coverageWindowId,
        segment: input.segment,
        queryFingerprint: input.queryFingerprint,
        actorInput: input.plan.actorInput,
        inputCursor: input.plan.inputCursor,
        postFilterText: input.postFilterText,
        maxTotalChargeUsd: input.plan.maxTotalChargeUsd,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object'
        && error != null
        && typeof (error as { runId?: unknown }).runId === 'string'
        && typeof (error as { datasetId?: unknown }).datasetId === 'string'
      ) {
        return {
          state: (error as { stage?: unknown }).stage === 'polling' ? 'run_incomplete' : 'import_failed',
          runId: (error as { runId: string }).runId,
          datasetId: (error as { datasetId: string }).datasetId,
        };
      }
      throw error;
    }
  }
}
