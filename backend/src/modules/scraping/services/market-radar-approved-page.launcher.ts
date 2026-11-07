import { MarketRadarGapPlan } from './market-radar-gap-plan.service';
import { MarketRadarSegment } from './market-radar-coverage-window';

type GapPlanCommand = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    maxItems: number;
  }): Promise<MarketRadarGapPlan>;
};

type ApprovedPageCommand = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    postFilterText: string | null;
    plan: MarketRadarGapPlan;
  }): Promise<unknown>;
};

type ApprovedPageFactory = {
  readToken(): string;
  createCommand(token: string): ApprovedPageCommand;
};

export class MarketRadarApprovedPageLauncher {
  constructor(
    private readonly gapPlan: GapPlanCommand,
    private readonly factory: ApprovedPageFactory,
  ) {}

  async execute(input: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    maxItems: number;
    postFilterText: string | null;
  }): Promise<unknown> {
    const plan = await this.gapPlan.execute({
      coverageWindowId: input.coverageWindowId,
      segment: input.segment,
      queryFingerprint: input.queryFingerprint,
      actorInput: input.actorInput,
      maxItems: input.maxItems,
    });
    if (plan.state === 'covered') return { state: 'covered' };

    const token = this.factory.readToken().trim();
    if (!token) throw new Error('APIFY_TOKEN is required');

    return this.factory.createCommand(token).execute({
      coverageWindowId: input.coverageWindowId,
      segment: input.segment,
      queryFingerprint: input.queryFingerprint,
      postFilterText: input.postFilterText,
      plan,
    });
  }
}
