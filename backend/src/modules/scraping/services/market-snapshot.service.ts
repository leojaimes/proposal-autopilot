import { Injectable } from '@nestjs/common';
import { MarketCategoryLane, MarketTaxonomyKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { MarketSnapshotCalculator, MarketSnapshotJob } from './market-snapshot-calculator.service';

const CALCULATION_VERSION = 'market-radar-v1';

type CategoryResult = {
  taxonomyNodeId: string;
  jobs: Array<MarketSnapshotJob & { fitEvaluations: Array<{ positioningProfileId: string | null; overallScore: number }> }>;
  metrics: ReturnType<MarketSnapshotCalculator['calculate']>;
};

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
          select: { taxonomyNodeId: true, lane: true },
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
        jobs,
        metrics: this.calculator.calculate(jobs, snapshotDate),
      };
    });

    const demandMaximum = Math.max(0, ...results.map((result) => result.metrics.demand30d));
    const observedProposalMedians = results
      .flatMap((result) => result.metrics.medianProposals == null ? [] : [result.metrics.medianProposals]);
    const competitionMinimum = Math.min(...observedProposalMedians);
    const competitionMaximum = Math.max(...observedProposalMedians);

    await this.prisma.$transaction(async (transaction) => {
      for (const result of results) {
        const { evidenceJobIds, ...snapshotMetrics } = result.metrics;
        const persistedMetrics = {
          ...snapshotMetrics,
          metricCoverage: snapshotMetrics.metricCoverage as unknown as Prisma.InputJsonValue,
        };
        const snapshot = await transaction.marketCategorySnapshot.upsert({
          where: {
            uq_market_snapshot_version: {
              tenantId,
              taxonomyNodeId: result.taxonomyNodeId,
              asOf: snapshotDate,
              calculationVersion: CALCULATION_VERSION,
            },
          },
          create: {
            tenantId,
            taxonomyNodeId: result.taxonomyNodeId,
            asOf: snapshotDate,
            calculationVersion: CALCULATION_VERSION,
            ...persistedMetrics,
          },
          update: {
            ...persistedMetrics,
          },
        });

        await transaction.marketSnapshotEvidenceJob.deleteMany({ where: { snapshotId: snapshot.id } });
        if (evidenceJobIds.length > 0) {
          await transaction.marketSnapshotEvidenceJob.createMany({
            data: evidenceJobIds.map((jobPostId) => ({ snapshotId: snapshot.id, jobPostId })),
          });
        }

        for (const profile of profiles) {
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

          await transaction.profileOpportunitySnapshot.upsert({
            where: {
              uq_profile_opportunity_snapshot: {
                profileId: profile.id,
                marketCategorySnapshotId: snapshot.id,
                calculationVersion: CALCULATION_VERSION,
              },
            },
            create: {
              tenantId,
              profileId: profile.id,
              marketCategorySnapshotId: snapshot.id,
              lane,
              profileFit,
              overallOpportunity,
              fitSampleJobs: fitScores.length,
              calculationVersion: CALCULATION_VERSION,
            },
            update: {
              lane,
              profileFit,
              overallOpportunity,
              fitSampleJobs: fitScores.length,
            },
          });
        }
      }
    });

    return { categories: results.length, profiles: profiles.length, asOf: snapshotDate };
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
