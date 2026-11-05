type HistoryRow = Record<string, unknown>;

type HistoryRun = {
  runId: string;
  datasetId: string;
  items: HistoryRow[];
};

export type ProtectedCatalogRow = {
  externalUpworkId: string;
  jobUrl: string;
  postedAt: Date;
  title: string;
  description: string;
  budgetType: 'FIXED' | 'HOURLY' | 'NOT_SHOWN';
  hourlyMin: number | null;
  hourlyMax: number | null;
  skills: string[];
  clientCountry: string | null;
  isPaymentVerified: boolean;
  clientTotalSpend: number | null;
  rawApifyPayload: Record<string, unknown>;
  isProtected: true;
};

type HistoryClient = { getMostRecent(limit: number): Promise<HistoryRun> };
export type ProtectedCatalogRepository = {
  hasCompletedProtectedSeed(): Promise<boolean>;
  saveProtected(rows: ProtectedCatalogRow[], provenance: { actorId: string; runId: string; datasetId: string }): Promise<void>;
};

export class UpworkHistorySeedImporter {
  constructor(
    private readonly historyClient: HistoryClient,
    private readonly catalog: ProtectedCatalogRepository,
  ) {}

  async importOnce() {
    if (await this.catalog.hasCompletedProtectedSeed()) return { imported: 0, skipped: true };
    const run = await this.historyClient.getMostRecent(1000);
    const rows = run.items
      .filter((item) => typeof item.id === 'string' && typeof item.url === 'string' && typeof item.postedAt === 'string')
      .sort((left, right) => String(right.postedAt).localeCompare(String(left.postedAt)))
      .slice(0, 1000)
      .map((item) => ({
        externalUpworkId: String(item.id), jobUrl: String(item.url), postedAt: new Date(String(item.postedAt)),
        title: String(item.title), description: String(item.description),
        budgetType: (item.jobType === 'fixed' ? 'FIXED' : item.jobType === 'hourly' ? 'HOURLY' : 'NOT_SHOWN') as 'FIXED' | 'HOURLY' | 'NOT_SHOWN',
        hourlyMin: typeof item.hourlyMin === 'number' ? item.hourlyMin : null,
        hourlyMax: typeof item.hourlyMax === 'number' ? item.hourlyMax : null,
        skills: Array.isArray(item.skills) ? item.skills.map(String) : [], clientCountry: typeof item.clientCountry === 'string' ? item.clientCountry : null,
        isPaymentVerified: item.clientPaymentVerified === true,
        clientTotalSpend: typeof item.clientTotalSpentAtPosting === 'number' ? item.clientTotalSpentAtPosting : null,
        rawApifyPayload: item,
        isProtected: true as const,
      }));
    await this.catalog.saveProtected(rows, { actorId: 'hyperbach/upwork-jobs-history', runId: run.runId, datasetId: run.datasetId });
    return { imported: rows.length, runId: run.runId, datasetId: run.datasetId };
  }
}
