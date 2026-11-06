type ActorRunClient = {
  callWithOutputStore(
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<{ runId: string; datasetId: string; keyValueStoreId: string }>;
};

type OutputReader = {
  read(storeId: string): Promise<{ nextPage: string | null; isNotificationMode: boolean }>;
};

export class MarketRadarApifyPageClient {
  constructor(
    private readonly actorRunClient: ActorRunClient,
    private readonly outputReader: OutputReader,
  ) {}

  async execute(input: Record<string, unknown>) {
    const run = await this.actorRunClient.callWithOutputStore('hyperbach/upwork-scraper-ai', input);
    const output = await this.outputReader.read(run.keyValueStoreId);
    return {
      runId: run.runId,
      datasetId: run.datasetId,
      nextPage: output.nextPage,
      isNotificationMode: output.isNotificationMode,
    };
  }
}
