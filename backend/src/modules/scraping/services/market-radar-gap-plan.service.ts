export type MarketRadarGapPlanDecision =
  | { state: 'covered' }
  | { state: 'continue'; inputCursor: string }
  | { state: 'uncovered' };

export type MarketRadarGapPlan = {
  state: MarketRadarGapPlanDecision['state'];
  actorInput: Record<string, unknown> | null;
  inputCursor: string | null;
  maxItems: number | null;
  maxTotalChargeUsd: number;
  approvalRequired: boolean;
};

export class MarketRadarGapPlanService {
  create(input: {
    decision: MarketRadarGapPlanDecision;
    actorInput: Record<string, unknown>;
    maxItems: number;
  }): MarketRadarGapPlan {
    if (input.decision.state === 'covered') {
      return {
        state: 'covered',
        actorInput: null,
        inputCursor: null,
        maxItems: null,
        maxTotalChargeUsd: 0,
        approvalRequired: false,
      };
    }

    if (input.decision.state === 'continue') {
      return {
        state: 'continue',
        actorInput: input.actorInput,
        inputCursor: input.decision.inputCursor,
        maxItems: input.maxItems,
        maxTotalChargeUsd: 1,
        approvalRequired: true,
      };
    }

    return {
      state: 'uncovered',
      actorInput: input.actorInput,
      inputCursor: null,
      maxItems: input.maxItems,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    };
  }
}
