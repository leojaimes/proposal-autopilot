import { Injectable } from '@nestjs/common';
import { RoleClassifierService } from './role-classifier.service';
import { StrategicLane } from '../constants/taxonomy.constants';

export interface FitCalculationInput {
  title: string;
  description: string;
  skills?: string[];
  clientTotalSpend?: number;
  clientRating?: number;
  proposalsCount?: number;
  isPaymentVerified?: boolean;
  postedDate?: Date;
}

export interface FitScoreOutput {
  overallScore: number;
  fitTier: 'HIGH' | 'MEDIUM' | 'LOW';
  strategicLane: StrategicLane;
  normalizedRole: string;
  skillScore: number;
  aiFeasibilityScore: number;
  clientQualityScore: number;
  recencyScore: number;
  isCapped: boolean;
  capReason: string | null;
  summaryRationale: string;
  detectedGaps: string;
  suggestedProofStory: string;
}

@Injectable()
export class FitCalculatorService {
  constructor(private readonly roleClassifier: RoleClassifierService) {}

  calculate(input: FitCalculationInput): FitScoreOutput {
    const classification = this.roleClassifier.classify(input.title, input.description, input.skills);

    // 1. Skill Score (Weight 40%)
    let skillScore = 40;
    if (classification.lane === StrategicLane.CORE_AI_UX) skillScore = 85;
    else if (classification.lane === StrategicLane.PRODUCT_STRATEGY) skillScore = 75;
    else if (classification.lane === StrategicLane.INTERFACE_BUILD) skillScore = 60;
    else if (classification.isDisqualified) skillScore = 15;

    // 2. AI Feasibility (Weight 25%)
    let aiFeasibilityScore = 65;
    if (classification.lane === StrategicLane.CORE_AI_UX) aiFeasibilityScore = 90;
    else if (classification.isDisqualified) aiFeasibilityScore = 30;

    // 3. Client Quality (Weight 20%)
    let clientQualityScore = 50;
    const spend = input.clientTotalSpend || 0;
    const rating = input.clientRating || 0;

    if (spend >= 100000) clientQualityScore = 100;
    else if (spend >= 25000) clientQualityScore = 85;
    else if (spend >= 5000) clientQualityScore = 70;
    else if (spend >= 500) clientQualityScore = 55;

    if (rating >= 4.8) clientQualityScore = Math.min(100, clientQualityScore + 10);
    if (!input.isPaymentVerified) clientQualityScore = Math.max(20, clientQualityScore - 20);

    // 4. Recency Score (Weight 15%)
    const recencyScore = 98; // Freshly scraped jobs

    // Cálculo Ponderado
    const weighted = Math.round(
      skillScore * 0.40 +
      aiFeasibilityScore * 0.25 +
      clientQualityScore * 0.20 +
      recencyScore * 0.15
    );

    // REGLA DE ORO DE ARQUITECTURA: Safety Net Cap
    let overallScore = weighted;
    let isCapped = false;
    let capReason: string | null = null;

    if (skillScore < 40 && overallScore > 44) {
      overallScore = 44;
      isCapped = true;
      capReason = 'CAPPED at 44: skill match under 40';
    }

    const fitTier = overallScore >= 75 ? 'HIGH' : overallScore >= 45 ? 'MEDIUM' : 'LOW';

    return {
      overallScore,
      fitTier,
      strategicLane: classification.lane,
      normalizedRole: classification.normalizedRole,
      skillScore,
      aiFeasibilityScore,
      clientQualityScore,
      recencyScore,
      isCapped,
      capReason,
      summaryRationale: `skill ${skillScore} / AI ${aiFeasibilityScore} / client ${clientQualityScore} / recency ${recencyScore}.`,
      detectedGaps: classification.isDisqualified ? 'Explicitly off-niche task' : 'Review domain specific alignment',
      suggestedProofStory: classification.suggestedProofStory,
    };
  }
}
