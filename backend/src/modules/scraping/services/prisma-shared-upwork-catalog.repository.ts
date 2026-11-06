import { Prisma, PrismaClient } from '@prisma/client';
import { ProtectedCatalogRepository, ProtectedCatalogRow } from './upwork-history-seed-importer';

type ApifyProvenance = {
  actorId: 'hyperbach/upwork-jobs-history';
  runId: string;
  datasetId: string;
};

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

export class PrismaSharedUpworkCatalogRepository implements ProtectedCatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hasCompletedProtectedSeed() {
    return (await this.prisma.sharedUpworkJob.count({ where: { isProtected: true } })) >= 1000;
  }

  async saveProtected(rows: ProtectedCatalogRow[], provenance: ApifyProvenance) {
    await this.prisma.sharedUpworkJob.createMany({
      data: rows.map(({ rawApifyPayload, ...row }) => ({
        externalUpworkId: row.externalUpworkId,
        title: row.title,
        description: row.description,
        jobUrl: row.jobUrl,
        postedAt: row.postedAt,
        rawApifyPayload: rawApifyPayload as Prisma.InputJsonValue,
        isProtected: row.isProtected,
        sourceRunId: provenance.runId,
        sourceDatasetId: provenance.datasetId,
      })),
      skipDuplicates: true,
    });
  }

  async saveLive(rows: LiveCatalogRow[], provenance: Omit<ApifyProvenance, 'actorId'> & { actorId: 'hyperbach/upwork-scraper-ai' }) {
    const created = await this.prisma.sharedUpworkJob.createMany({
      data: rows.map((row) => ({
        ...row,
        sourceRunId: provenance.runId,
        sourceDatasetId: provenance.datasetId,
        sourceKind: 'LIVE',
        sourceActorId: provenance.actorId,
        isProtected: false,
      })),
      skipDuplicates: true,
    });

    const existingLiveJobs = await this.prisma.sharedUpworkJob.findMany({
      where: {
        externalUpworkId: { in: rows.map((row) => row.externalUpworkId) },
        sourceKind: 'LIVE',
      },
      select: { id: true, externalUpworkId: true },
    });
    const liveJobIds = new Map(existingLiveJobs.map((job) => [job.externalUpworkId, job.id]));
    const createdSegments = await this.prisma.sharedUpworkJobSegment.createMany({
      data: rows.flatMap((row) => {
        const jobId = liveJobIds.get(row.externalUpworkId);
        return jobId ? [{ jobId, segment: row.sourceSegment }] : [];
      }),
      skipDuplicates: true,
    });
    return { newJobs: created.count, newSegmentAssignments: createdSegments.count };
  }
}
