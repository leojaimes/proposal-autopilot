type ApifyResponse = { ok: boolean; json(): Promise<unknown> };
type Fetcher = (url: string, init: RequestInit) => Promise<ApifyResponse>;

export class ApifyRunOutputReader {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  async read(storeId: string): Promise<{ nextPage: string | null; isNotificationMode: boolean }> {
    const response = await this.fetcher(
      `https://api.apify.com/v2/key-value-stores/${storeId}/records/OUTPUT?attachment=true`,
      { headers: { authorization: `Bearer ${this.token}` } },
    );
    if (!response.ok) throw new Error('Apify OUTPUT record could not be read');
    const output = await response.json() as {
      nextPage?: unknown; is_notification_mode?: unknown;
      metadata?: { next_page?: unknown; is_notification_mode?: unknown };
    };
    const nextPage = output.nextPage ?? output.metadata?.next_page;
    const isNotificationMode = output.is_notification_mode ?? output.metadata?.is_notification_mode;
    if (typeof isNotificationMode !== 'boolean') throw new Error('Apify OUTPUT record is invalid');
    if (nextPage != null && typeof nextPage !== 'string') throw new Error('Apify OUTPUT record is invalid');
    return { nextPage: typeof nextPage === 'string' ? nextPage : null, isNotificationMode };
  }
}
