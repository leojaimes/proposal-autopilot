import { PrismaService } from '../../../core/database/prisma.service';

type EvidencePrisma = Pick<PrismaService, 'sharedUpworkJob' | 'marketRadarCoveragePage'>;

export type SharedMarketEvidence = {
  segment: string;
  sampleJobs: number;
  oldestPostedAt: Date;
  newestPostedAt: Date;
  coverage: 'COMPLETE' | 'PARTIAL';
};

export class SharedMarketEvidenceService {
  constructor(private readonly prisma: EvidencePrisma) {}

  async list(): Promise<SharedMarketEvidence[]> {
    const [jobs, pages] = await Promise.all([
      this.prisma.sharedUpworkJob.findMany({
        select: { postedAt: true, segments: { select: { segment: true } } },
      }),
      this.prisma.marketRadarCoveragePage.findMany({
        orderBy: { recordedAt: 'asc' },
        select: { segment: true, outputCursor: true },
      }),
    ]);
    const coverageBySegment = new Map(pages.map((page) => [page.segment, page.outputCursor == null ? 'COMPLETE' : 'PARTIAL'] as const));
    const evidenceBySegment = new Map<string, SharedMarketEvidence>();

    for (const job of jobs) {
      for (const { segment } of job.segments) {
        const current = evidenceBySegment.get(segment);
        if (current) {
          current.sampleJobs += 1;
          if (job.postedAt < current.oldestPostedAt) current.oldestPostedAt = job.postedAt;
          if (job.postedAt > current.newestPostedAt) current.newestPostedAt = job.postedAt;
          continue;
        }
        evidenceBySegment.set(segment, {
          segment,
          sampleJobs: 1,
          oldestPostedAt: job.postedAt,
          newestPostedAt: job.postedAt,
          coverage: coverageBySegment.get(segment) ?? 'PARTIAL',
        });
      }
    }
    return [...evidenceBySegment.values()].sort((left, right) => left.segment.localeCompare(right.segment));
  }
}
