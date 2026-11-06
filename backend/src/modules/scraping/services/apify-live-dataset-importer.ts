import { Prisma } from '@prisma/client';
import { matchesApifyJobText } from './apify-job-text-matcher';

type LiveCatalogRow = {
  externalUpworkId: string;
  title: string;
  description: string;
  jobUrl: string;
  postedAt: Date;
  rawApifyPayload: Prisma.InputJsonValue;
  sourceObservedAt: Date;
  sourceSegment: string;
};

type DatasetReader = (datasetId: string, token: string) => Promise<Record<string, unknown>[]>;

type SharedCatalog = {
  saveLive(
    rows: LiveCatalogRow[],
    provenance: { actorId: 'hyperbach/upwork-scraper-ai'; runId: string; datasetId: string },
  ): Promise<{ newJobs: number; newSegmentAssignments: number }>;
};

function rowFromLivePayload(raw: Record<string, unknown>, segment: string, postFilterText: string | null): LiveCatalogRow | null {
  if (typeof raw.id !== 'string' || typeof raw.url !== 'string' || typeof raw.date_posted !== 'string') return null;
  if (postFilterText && !matchesApifyJobText(raw, postFilterText)) return null;
  const postedAt = new Date(raw.date_posted);
  if (Number.isNaN(postedAt.valueOf())) return null;
  const observedAt = new Date(typeof raw.refreshed_at === 'string' ? raw.refreshed_at : String(raw.created_at ?? raw.date_posted));
  return {
    externalUpworkId: raw.id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Upwork job',
    description: typeof raw.description === 'string' ? raw.description : '',
    jobUrl: raw.url,
    postedAt,
    rawApifyPayload: raw as Prisma.InputJsonValue,
    sourceObservedAt: Number.isNaN(observedAt.valueOf()) ? postedAt : observedAt,
    sourceSegment: segment,
  };
}

export class ApifyLiveDatasetImporter {
  constructor(
    private readonly token: string,
    private readonly readDataset: DatasetReader,
    private readonly catalog: SharedCatalog,
  ) {}

  async importDataset(input: { datasetId: string; runId: string; segment: string; postFilterText: string | null }) {
    const rows = (await this.readDataset(input.datasetId, this.token))
      .map((raw) => rowFromLivePayload(raw, input.segment, input.postFilterText))
      .filter((row): row is LiveCatalogRow => row != null);
    return this.catalog.saveLive(rows, {
      actorId: 'hyperbach/upwork-scraper-ai',
      runId: input.runId,
      datasetId: input.datasetId,
    });
  }
}
