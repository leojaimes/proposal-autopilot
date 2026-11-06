type ApifyResponse = { ok: boolean; json(): Promise<unknown> };
type Fetcher = (url: string, init: RequestInit) => Promise<ApifyResponse>;

export class ApifyActorRunClient {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  async call(
    actorId: string,
    input: Record<string, unknown>,
    options?: { maxTotalChargeUsd?: number },
  ): Promise<{ runId: string; datasetId: string }> {
    const result = await this.run(actorId, input, options);
    return { runId: result.runId, datasetId: result.datasetId };
  }

  private async run(
    actorId: string,
    input: Record<string, unknown>,
    options?: { maxTotalChargeUsd?: number },
  ): Promise<{ runId: string; datasetId: string; keyValueStoreId?: string }> {
    const maxCharge = options?.maxTotalChargeUsd == null ? '' : `&maxTotalChargeUsd=${options.maxTotalChargeUsd}`;
    const response = await this.fetcher(
      `https://api.apify.com/v2/acts/${actorId.replace('/', '~')}/runs?waitForFinish=60${maxCharge}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) throw new Error('Apify actor run could not be started');
    const payload = await response.json() as {
      data?: { id?: unknown; status?: unknown; defaultDatasetId?: unknown; defaultKeyValueStoreId?: unknown };
    };
    if (typeof payload.data?.status !== 'string') {
      throw new Error('Apify actor run returned an invalid response');
    }
    if (payload.data.status !== 'SUCCEEDED') {
      throw new Error('Apify actor run did not succeed');
    }
    if (
      typeof payload.data.id !== 'string'
      || typeof payload.data.defaultDatasetId !== 'string'
    ) {
      throw new Error('Apify actor run returned an invalid response');
    }
    return {
      runId: payload.data.id,
      datasetId: payload.data.defaultDatasetId,
      keyValueStoreId: typeof payload.data.defaultKeyValueStoreId === 'string'
        ? payload.data.defaultKeyValueStoreId
        : undefined,
    };
  }

  async callWithOutputStore(
    actorId: string,
    input: Record<string, unknown>,
    options?: { maxTotalChargeUsd?: number },
  ): Promise<{ runId: string; datasetId: string; keyValueStoreId: string }> {
    const result = await this.run(actorId, input, options);
    if (typeof result.keyValueStoreId !== 'string') {
      throw new Error('Apify actor run returned an invalid response');
    }
    return result as { runId: string; datasetId: string; keyValueStoreId: string };
  }
}
