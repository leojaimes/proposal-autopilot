import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketCategoryLane, MarketRadarDecisionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { MarketRadarOperationsService } from './market-radar-operations.service';

type ActiveProfile = {
  id: string;
  isActive: boolean;
  personaName: string;
  roleTitle: string;
  offerHeadline: string;
};

export type CreateMarketRadarDecisionInput = {
  tenantId: string;
  profile: ActiveProfile | null;
  snapshotId: string;
  status: MarketRadarDecisionStatus;
  rationale: string;
  operator: string;
};

export type UpdateMarketRadarDecisionOutcomeInput = {
  tenantId: string;
  decisionId: string;
  jobPostId?: string;
  proposalId?: string;
  submittedAt?: Date;
  qualifiedRepliedAt?: Date;
  interviewedAt?: Date;
  wonAt?: Date;
  realizedValue?: number;
};

@Injectable()
export class MarketRadarDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly radarOperations: MarketRadarOperationsService,
  ) {}

  async createDecision(input: CreateMarketRadarDecisionInput) {
    const rationale = input.rationale.trim();
    const operator = input.operator.trim();
    if (!Object.values(MarketRadarDecisionStatus).includes(input.status)) {
      throw new BadRequestException('El estado de decisión de Radar no es válido.');
    }
    if (!input.profile?.isActive) {
      throw new BadRequestException('Se requiere un perfil activo para registrar una decisión de Radar.');
    }
    if (!rationale) throw new BadRequestException('La razón de la decisión es obligatoria.');
    if (!operator) throw new BadRequestException('La persona que toma la decisión es obligatoria.');

    const snapshot = await this.prisma.marketCategorySnapshot.findFirst({
      where: { id: input.snapshotId, tenantId: input.tenantId },
      include: {
        taxonomyNode: { select: { id: true, name: true, slug: true } },
        evidenceJobs: { select: { jobPostId: true } },
        profileOpportunities: {
          where: { profileId: input.profile.id },
          select: { lane: true, profileFit: true, overallOpportunity: true, fitSampleJobs: true, profileEligibility: true, calculationVersion: true },
        },
      },
    });
    if (!snapshot) throw new NotFoundException('El snapshot de Radar no existe para este tenant.');

    const health = await this.radarOperations.getHealth(input.tenantId);
    if (health.state !== 'READY') {
      throw new BadRequestException(`No se puede registrar una decisión mientras el Radar está ${health.state}.`);
    }

    const opportunity = snapshot.profileOpportunities[0] ?? null;
    if (!opportunity || opportunity.profileEligibility !== 'ELIGIBLE') {
      throw new BadRequestException('La categoría no tiene un ajuste elegible y observado para el perfil activo.');
    }

    const snapshotContext: Prisma.InputJsonValue = {
      snapshotId: snapshot.id,
      category: snapshot.taxonomyNode,
      asOf: snapshot.asOf.toISOString(),
      calculationVersion: snapshot.calculationVersion,
      periodStart: snapshot.periodStart.toISOString(),
      periodEnd: snapshot.periodEnd.toISOString(),
      demand7d: snapshot.demand7d,
      demand30d: snapshot.demand30d,
      medianProposals: snapshot.medianProposals == null ? null : Number(snapshot.medianProposals),
      medianBudget: snapshot.medianBudget == null ? null : Number(snapshot.medianBudget),
      verifiedClientsPct: snapshot.verifiedClientsPct == null ? null : Number(snapshot.verifiedClientsPct),
      sampleJobs: snapshot.sampleJobs,
      sampleConfidence: snapshot.sampleConfidence == null ? null : Number(snapshot.sampleConfidence),
      metricCoverage: snapshot.metricCoverage,
      sourceBatchCount: snapshot.sourceBatchCount,
    };
    const profileContext: Prisma.InputJsonValue = {
      profileId: input.profile.id,
      personaName: input.profile.personaName,
      roleTitle: input.profile.roleTitle,
      offerHeadline: input.profile.offerHeadline,
      lane: opportunity.lane,
      profileFit: Number(opportunity.profileFit),
      overallOpportunity: opportunity.overallOpportunity == null ? null : Number(opportunity.overallOpportunity),
      fitSampleJobs: opportunity.fitSampleJobs,
      calculationVersion: opportunity.calculationVersion,
    };

    return this.prisma.marketRadarDecision.create({
      data: {
        tenantId: input.tenantId,
        marketCategorySnapshotId: snapshot.id,
        positioningProfileId: input.profile.id,
        taxonomyNodeId: snapshot.taxonomyNode.id,
        status: input.status,
        rationale,
        operatorLabel: operator,
        snapshotContext,
        profileContext,
        evidenceJobIds: snapshot.evidenceJobs.map((item) => item.jobPostId),
      },
      include: { outcome: true },
    });
  }

  async updateOutcome(input: UpdateMarketRadarDecisionOutcomeInput) {
    const hasOutcomeUpdate = [
      input.jobPostId,
      input.proposalId,
      input.submittedAt,
      input.qualifiedRepliedAt,
      input.interviewedAt,
      input.wonAt,
      input.realizedValue,
    ].some((value) => value !== undefined);
    if (!hasOutcomeUpdate) throw new BadRequestException('Se requiere al menos un dato de resultado para actualizar la decisión.');

    const decision = await this.prisma.marketRadarDecision.findFirst({
      where: { id: input.decisionId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!decision) throw new NotFoundException('La decisión de Radar no existe para este tenant.');

    let resolvedJobPostId = input.jobPostId;
    if (input.jobPostId) {
      const job = await this.prisma.jobPost.findFirst({ where: { id: input.jobPostId, tenantId: input.tenantId }, select: { id: true } });
      if (!job) throw new BadRequestException('El trabajo relacionado no existe para este tenant.');
    }
    if (input.proposalId) {
      const proposal = await this.prisma.proposal.findFirst({
        where: { id: input.proposalId, jobPost: { tenantId: input.tenantId } },
        select: { id: true, jobPostId: true },
      });
      if (!proposal) throw new BadRequestException('La propuesta relacionada no existe para este tenant.');
      if (resolvedJobPostId && resolvedJobPostId !== proposal.jobPostId) {
        throw new BadRequestException('El trabajo y la propuesta deben referirse a la misma oportunidad.');
      }
      resolvedJobPostId = proposal.jobPostId;
    }

    return this.prisma.marketRadarDecisionOutcome.upsert({
      where: { marketRadarDecisionId: decision.id },
      create: {
        marketRadarDecisionId: decision.id,
        jobPostId: resolvedJobPostId,
        proposalId: input.proposalId,
        submittedAt: input.submittedAt,
        qualifiedRepliedAt: input.qualifiedRepliedAt,
        interviewedAt: input.interviewedAt,
        wonAt: input.wonAt,
        realizedValue: input.realizedValue,
      },
      update: {
        ...(resolvedJobPostId !== undefined && { jobPostId: resolvedJobPostId }),
        ...(input.proposalId !== undefined && { proposalId: input.proposalId }),
        ...(input.submittedAt !== undefined && { submittedAt: input.submittedAt }),
        ...(input.qualifiedRepliedAt !== undefined && { qualifiedRepliedAt: input.qualifiedRepliedAt }),
        ...(input.interviewedAt !== undefined && { interviewedAt: input.interviewedAt }),
        ...(input.wonAt !== undefined && { wonAt: input.wonAt }),
        ...(input.realizedValue !== undefined && { realizedValue: input.realizedValue }),
      },
    });
  }
}
