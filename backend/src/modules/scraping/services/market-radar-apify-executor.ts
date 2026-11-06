type ApifyActorClient = {
  call(actorId: string, input: Record<string, unknown>): Promise<{ runId: string; datasetId: string }>;
};

type PreparedActorRequest = {
  actorInput: Record<string, unknown>;
  inputCursor: string | null;
};

export class MarketRadarApifyExecutor {
  constructor(private readonly client: ApifyActorClient) {}

  execute(request: PreparedActorRequest) {
    return this.client.call('hyperbach/upwork-scraper-ai', {
      ...request.actorInput,
      ...(request.inputCursor ? { page_after: request.inputCursor } : {}),
    });
  }
}
