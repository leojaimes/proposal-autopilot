import { Prisma, PrismaClient } from '@prisma/client';
import { ProtectedCatalogRepository, ProtectedCatalogRow } from './upwork-history-seed-importer';

type ApifyProvenance = {
  actorId: 'hyperbach/upwork-jobs-history';
  runId: string;
  datasetId: string;
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
}
