import { Injectable } from '@nestjs/common';
import { RoleClassifierService } from './role-classifier.service';
import { StrategicLane } from '../constants/taxonomy.constants';

export interface FitCalculationInput {
  title: string;
  description: string;
  skills?: string[];
  clientTotalSpend?: number;
  clientRating?: number;
  clientCountry?: string;
  proposalsCount?: number;
  isPaymentVerified?: boolean;
  postedDate?: Date;
  targetCountries?: string[];
  targetRegions?: string[];
  excludedCountries?: string[];
  geoFilterMode?: string;
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

    // Evaluación Geográfica (Mercados Objetivo y Lista Negra)
    const country = (input.clientCountry || '').trim().toLowerCase();
    const excluded = (input.excludedCountries || []).map(c => c.trim().toLowerCase()).filter(Boolean);
    const targets = (input.targetCountries || []).map(c => c.trim().toLowerCase()).filter(Boolean);

    const isExcluded = country && excluded.some(exc => country.includes(exc) || exc.includes(country));
    const isTarget = country && targets.length > 0 && targets.some(t => 
      country.includes(t) || t.includes(country) || 
      (t.includes('united states') && (country === 'us' || country === 'usa'))
    );

    // Bono Geográfico (+15 pts si es mercado objetivo)
    if (isTarget) {
      clientQualityScore = Math.min(100, clientQualityScore + 15);
    }

    // 4. Recency Score (Weight 15%) - Basado en la fecha real de publicación
    let recencyScore = 80;
    if (input.postedDate) {
      const diffHours = Math.max(0, (Date.now() - new Date(input.postedDate).getTime()) / (1000 * 60 * 60));
      if (diffHours <= 2) recencyScore = 100;
      else if (diffHours <= 6) recencyScore = 90;
      else if (diffHours <= 12) recencyScore = 80;
      else if (diffHours <= 24) recencyScore = 70;
      else if (diffHours <= 48) recencyScore = 55;
      else recencyScore = 35;
    }

    // Factor Competencia: Premiar <5 aplicantes y castigar saturación >20-50
    if (typeof input.proposalsCount === 'number') {
      if (input.proposalsCount > 50) {
        aiFeasibilityScore = Math.max(20, aiFeasibilityScore - 25);
      } else if (input.proposalsCount > 20) {
        aiFeasibilityScore = Math.max(30, aiFeasibilityScore - 15);
      } else if (input.proposalsCount <= 5) {
        aiFeasibilityScore = Math.min(100, aiFeasibilityScore + 10);
      }
    }

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

    // Cap Geográfico Estricto (si modo es STRICT_EXCLUDE)
    if (input.geoFilterMode === 'STRICT_EXCLUDE') {
      if (isExcluded) {
        overallScore = 15;
        isCapped = true;
        capReason = `GEO DISQUALIFIED: Cliente en país excluido (${input.clientCountry})`;
      } else if (targets.length > 0 && !isTarget) {
        overallScore = 25;
        isCapped = true;
        capReason = `GEO FILTERED: Fuera de países objetivo (${input.clientCountry || 'Desconocido'})`;
      }
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
