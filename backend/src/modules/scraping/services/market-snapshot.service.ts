import { Injectable } from '@nestjs/common';
import {
  MarketAiLeverageState,
  MarketCategoryLane,
  MarketTaxonomyKind,
  Prisma,
  ProfileEligibility,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { MarketSnapshotCalculator, MarketSnapshotJob } from './market-snapshot-calculator.service';

const CALCULATION_VERSION = 'market-radar-v1';

type CategoryResult = {
  taxonomyNodeId: string;
  taxonomyVersion: number;
  metadata: Prisma.JsonValue | null;
  jobs: Array<MarketSnapshotJob & { fitEvaluations: Array<{ positioningProfileId: string | null; overallScore: number }> }>;
  metrics: ReturnType<MarketSnapshotCalculator['calculate']>;
  profileOpportunities: ProfileOpportunityPayload[];
};

type PersistedMetrics = Omit<ReturnType<MarketSnapshotCalculator['calculate']>, 'evidenceJobIds' | 'metricCoverage'> & {
  metricCoverage: Prisma.InputJsonValue;
};

type ProfileOpportunityPayload = {
  profileId: string;
  lane: MarketCategoryLane;
  profileFit: number | null;
  overallOpportunity: number | null;
  fitSampleJobs: number;
  profileEligibility: ProfileEligibility;
  aiLeverageState: MarketAiLeverageState;
  aiLeverageCapability: string | null;
  aiLeverageTask: string | null;
  aiLeverageExplanation: string | null;
};

type AiLeverageDeclaration = {
  capability: string;
  task: string | null;
  explanation: string | null;
};

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readAiLeverageDeclaration(metadata: Prisma.JsonValue | null): AiLeverageDeclaration | null {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const declaration = (metadata as Record<string, unknown>).aiLeverage;
  if (declaration == null || typeof declaration !== 'object' || Array.isArray(declaration)) return null;
  const capability = optionalText((declaration as Record<string, unknown>).capability);
  if (capability == null) return null;
  return {
    capability,
    task: optionalText((declaration as Record<string, unknown>).task),
    explanation: optionalText((declaration as Record<string, unknown>).explanation),
  };
}

function utcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function scaledDemand(value: number, cohortMaximum: number): number {
  return cohortMaximum === 0 ? 0 : (value / cohortMaximum) * 100;
}

function inverseCompetition(value: number, cohortMinimum: number, cohortMaximum: number): number {
  if (cohortMinimum === cohortMaximum) return 50;
  return ((cohortMaximum - value) / (cohortMaximum - cohortMinimum)) * 100;
}

function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceLineage(
  taxonomyVersion: number,
  evidenceJobIds: string[],
  jobs: MarketSnapshotJob[],
): Prisma.InputJsonValue {
  return {
    taxonomyVersion,
    evidenceJobIds: [...evidenceJobIds].sort(),
    sourceBatchIds: [...new Set(
      jobs
        .filter((job) => evidenceJobIds.includes(job.id))
        .flatMap((job) => job.batchRunId == null ? [] : [job.batchRunId]),
    )].sort(),
  };
}

@Injectable()
export class MarketSnapshotService {
  private readonly calculator = new MarketSnapshotCalculator();

  constructor(private readonly prisma: PrismaService) {}

  async rebuildForTenant(tenantId: string, asOf = new Date()) {
    const snapshotDate = utcDate(asOf);
    const profiles = await this.prisma.positioningProfile.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        categoryPolicies: {
          where: { isActive: true },
          select: { taxonomyNodeId: true, lane: true, aiLeverageEnabled: true },
        },
      },
    });
    const profileIds = profiles.map((profile) => profile.id);
    const categories = await this.prisma.marketTaxonomyNode.findMany({
      where: {
        isActive: true,
        kind: { in: [MarketTaxonomyKind.SUBCATEGORY, MarketTaxonomyKind.OCCUPATION] },
      },
      select: {
        id: true,
        taxonomyVersion: true,
        metadata: true,
        jobAssignments: {
          where: { tenantId, isPrimary: true },
          select: {
            jobPost: {
              select: {
                id: true,
                batchRunId: true,
                postedAt: true,
                postedAtKnown: true,
                proposalsCount: true,
                proposalsCountKnown: true,
                budgetFixed: true,
                isPaymentVerified: true,
                paymentVerificationKnown: true,
                fitEvaluations: {
                  where: { positioningProfileId: { in: profileIds } },
                  select: { positioningProfileId: true, overallScore: true },
                },
              },
            },
          },
        },
      },
    });

    const results: CategoryResult[] = categories.map((category) => {
      const jobs = category.jobAssignments.map(({ jobPost }) => ({
        id: jobPost.id,
        batchRunId: jobPost.batchRunId,
        postedAt: jobPost.postedAt,
        postedAtKnown: jobPost.postedAtKnown,
        proposalsCount: jobPost.proposalsCount,
        proposalsCountKnown: jobPost.proposalsCountKnown,
        budgetFixed: jobPost.budgetFixed == null ? null : Number(jobPost.budgetFixed),
        isPaymentVerified: jobPost.isPaymentVerified,
        paymentVerificationKnown: jobPost.paymentVerificationKnown,
        fitEvaluations: jobPost.fitEvaluations.map((evaluation) => ({
          positioningProfileId: evaluation.positioningProfileId,
          overallScore: evaluation.overallScore,
        })),
      }));

      return {
        taxonomyNodeId: category.id,
        taxonomyVersion: category.taxonomyVersion,
        metadata: category.metadata,
        jobs,
        metrics: this.calculator.calculate(jobs, snapshotDate),
        profileOpportunities: [],
      };
    });

    const demandMaximum = Math.max(0, ...results.map((result) => result.metrics.demand30d));
    const observedProposalMedians = results
      .flatMap((result) => result.metrics.medianProposals == null ? [] : [result.metrics.medianProposals]);
    const competitionMinimum = Math.min(...observedProposalMedians);
    const competitionMaximum = Math.max(...observedProposalMedians);

    for (const result of results) {
      const evidenceJobIds = result.metrics.evidenceJobIds;
      result.profileOpportunities = profiles.map((profile) => {
        const policy = profile.categoryPolicies.find((item) => item.taxonomyNodeId === result.taxonomyNodeId);
        const lane = policy?.lane ?? MarketCategoryLane.ADJACENT;
        const fitScores = result.jobs
          .filter((job) => evidenceJobIds.includes(job.id))
          .flatMap((job) => job.fitEvaluations
            .filter((evaluation) => evaluation.positioningProfileId === profile.id)
            .map((evaluation) => evaluation.overallScore));
        const profileFit = average(fitScores);
        const hasObservedCompetition = result.metrics.medianProposals != null;
        const overallOpportunity = lane === MarketCategoryLane.EXCLUDED || profileFit == null || !hasObservedCompetition
          ? null
          : this.calculateOpportunity({
            demand30d: result.metrics.demand30d,
            demandMaximum,
            medianProposals: result.metrics.medianProposals,
            competitionMinimum,
            competitionMaximum,
            verifiedClientsPct: result.metrics.verifiedClientsPct,
            profileFit,
          });
        const profileEligibility = policy?.lane === MarketCategoryLane.EXCLUDED
          ? ProfileEligibility.EXCLUDED
          : policy == null || profileFit == null || fitScores.length === 0 || overallOpportunity == null
            ? ProfileEligibility.PENDING
            : ProfileEligibility.ELIGIBLE;
        const aiLeverage = policy?.aiLeverageEnabled ? readAiLeverageDeclaration(result.metadata) : null;

        return {
          profileId: profile.id,
          lane,
          profileFit,
          overallOpportunity,
          fitSampleJobs: fitScores.length,
          profileEligibility,
          aiLeverageState: aiLeverage == null ? MarketAiLeverageState.NOT_APPLICABLE : MarketAiLeverageState.APPLICABLE,
          aiLeverageCapability: aiLeverage?.capability ?? null,
          aiLeverageTask: aiLeverage?.task ?? null,
          aiLeverageExplanation: aiLeverage?.explanation ?? null,
        };
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const result of results) {
        const { evidenceJobIds, ...snapshotMetrics } = result.metrics;
        const persistedMetrics = {
          ...snapshotMetrics,
          metricCoverage: snapshotMetrics.metricCoverage as unknown as Prisma.InputJsonValue,
        };
        const lineage = sourceLineage(result.taxonomyVersion, evidenceJobIds, result.jobs);
        const snapshotContent = {
          taxonomyVersion: result.taxonomyVersion,
          calculationVersion: CALCULATION_VERSION,
          asOf: snapshotDate.toISOString(),
          metrics: persistedMetrics,
          sourceLineage: lineage,
          profileOpportunities: result.profileOpportunities,
        };
        const hash = contentHash(snapshotContent);
        const currentSnapshot = await transaction.marketCategorySnapshot.findFirst({
          where: {
            tenantId,
            taxonomyNodeId: result.taxonomyNodeId,
            asOf: snapshotDate,
            calculationVersion: CALCULATION_VERSION,
            isCurrent: true,
          },
          select: { id: true, revision: true, contentHash: true },
        });

        if (currentSnapshot?.contentHash === hash) continue;

        const snapshot = await this.createRevision(transaction, {
          tenantId,
          taxonomyNodeId: result.taxonomyNodeId,
          snapshotDate,
          taxonomyVersion: result.taxonomyVersion,
          sourceLineage: lineage,
          contentHash: hash,
          persistedMetrics,
          currentSnapshot,
        });

        if (evidenceJobIds.length > 0) {
          await transaction.marketSnapshotEvidenceJob.createMany({
            data: evidenceJobIds.map((jobPostId) => ({ snapshotId: snapshot.id, jobPostId })),
          });
        }

        if (result.profileOpportunities.length > 0) {
          await transaction.profileOpportunitySnapshot.createMany({
            data: result.profileOpportunities.map((opportunity) => ({
              tenantId,
              profileId: opportunity.profileId,
              marketCategorySnapshotId: snapshot.id,
              lane: opportunity.lane,
              profileFit: opportunity.profileFit,
              overallOpportunity: opportunity.overallOpportunity,
              fitSampleJobs: opportunity.fitSampleJobs,
              profileEligibility: opportunity.profileEligibility,
              aiLeverageState: opportunity.aiLeverageState,
              aiLeverageCapability: opportunity.aiLeverageCapability,
              aiLeverageTask: opportunity.aiLeverageTask,
              aiLeverageExplanation: opportunity.aiLeverageExplanation,
              calculationVersion: CALCULATION_VERSION,
            })),
          });
        }
      }
    });

    return { categories: results.length, profiles: profiles.length, asOf: snapshotDate };
  }

  private async createRevision(
    transaction: Prisma.TransactionClient,
    input: {
      tenantId: string;
      taxonomyNodeId: string;
      snapshotDate: Date;
      taxonomyVersion: number;
      sourceLineage: Prisma.InputJsonValue;
      contentHash: string;
      persistedMetrics: PersistedMetrics;
      currentSnapshot: { id: string; revision: number; contentHash: string } | null;
    },
  ) {
    const previousRevision = input.currentSnapshot?.revision ?? await transaction.marketCategorySnapshot.findFirst({
      where: {
        tenantId: input.tenantId,
        taxonomyNodeId: input.taxonomyNodeId,
        asOf: input.snapshotDate,
        calculationVersion: CALCULATION_VERSION,
      },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });

    if (input.currentSnapshot) {
      await transaction.marketCategorySnapshot.update({
        where: { id: input.currentSnapshot.id },
        data: { isCurrent: false },
      });
    }

    const previousRevisionNumber = typeof previousRevision === 'number'
      ? previousRevision
      : previousRevision?.revision ?? 0;

    return transaction.marketCategorySnapshot.create({
      data: {
        tenantId: input.tenantId,
        taxonomyNodeId: input.taxonomyNodeId,
        asOf: input.snapshotDate,
        revision: previousRevisionNumber + 1,
        isCurrent: true,
        taxonomyVersion: input.taxonomyVersion,
        sourceLineage: input.sourceLineage,
        contentHash: input.contentHash,
        calculationVersion: CALCULATION_VERSION,
        ...input.persistedMetrics,
      },
    });
  }

  private calculateOpportunity(input: {
    demand30d: number;
    demandMaximum: number;
    medianProposals: number;
    competitionMinimum: number;
    competitionMaximum: number;
    verifiedClientsPct: number | null;
    profileFit: number;
  }): number {
    const components = [
      { value: scaledDemand(input.demand30d, input.demandMaximum), weight: 35 },
      { value: inverseCompetition(input.medianProposals, input.competitionMinimum, input.competitionMaximum), weight: 25 },
      { value: input.profileFit, weight: 25 },
      ...(input.verifiedClientsPct == null ? [] : [{ value: input.verifiedClientsPct, weight: 15 }]),
    ];
    const totalWeight = components.reduce((total, component) => total + component.weight, 0);
    return Number((components.reduce((total, component) => total + component.value * component.weight, 0) / totalWeight).toFixed(2));
  }
}
