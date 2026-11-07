import { MarketRadarSegment } from './market-radar-coverage-window';
import {
  MarketRadarGapPlan,
  MarketRadarGapPlanDecision,
  MarketRadarGapPlanService,
} from './market-radar-gap-plan.service';

type CoveragePreflightCommand = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<MarketRadarGapPlanDecision>;
};

export class MarketRadarCoverageGapPlanCommand {
  constructor(
    private readonly preflight: CoveragePreflightCommand,
    private readonly gapPlan: MarketRadarGapPlanService,
  ) {}

  async execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    maxItems: number;
  }): Promise<MarketRadarGapPlan> {
    const decision = await this.preflight.execute(request);

    return this.gapPlan.create({
      decision,
      actorInput: request.actorInput,
      maxItems: request.maxItems,
    });
  }
}
