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
  proposalsCount?: number | null;
  isPaymentVerified?: boolean;
  postedDate?: Date | null;
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
  eligibilityStatus: 'ELIGIBLE' | 'PENDING' | 'EXCLUDED';
  dataQualityStatus: 'COMPLETE' | 'INCOMPLETE';
  summaryRationale: string;
  detectedGaps: string;
  suggestedProofStory: string;
}

@Injectable()
export class FitCalculatorService {
  constructor(private readonly roleClassifier: RoleClassifierService) {}

  calculate(input: FitCalculationInput): FitScoreOutput {
    const classification = this.roleClassifier.classify(input.title, input.description, input.skills);

    // 0. Integridad de Datos (Data Quality Status)
    const hasProposals = input.proposalsCount !== undefined && input.proposalsCount !== null;
    const hasDate = Boolean(input.postedDate);
    const hasCountry = Boolean((input.clientCountry || '').trim());
    const dataQualityStatus: 'COMPLETE' | 'INCOMPLETE' = (hasProposals && hasDate && hasCountry) ? 'COMPLETE' : 'INCOMPLETE';

    // 1. Skill Score (Weight 40%) - Escala completa hasta 100 con validación profunda
    let skillScore = 35;
    const hasMultipleSkills = Array.isArray(input.skills) && input.skills.length >= 2;

    if (classification.lane === StrategicLane.CORE_AI_UX) {
      skillScore = hasMultipleSkills ? 100 : 80;
    } else if (classification.lane === StrategicLane.SOFTWARE_BACKEND_API) {
      skillScore = hasMultipleSkills ? 100 : 85;
    } else if (classification.lane === StrategicLane.PRODUCT_STRATEGY) {
      skillScore = 85;
    } else if (classification.lane === StrategicLane.INTERFACE_BUILD) {
      skillScore = 70;
    } else if (classification.isDisqualified) {
      skillScore = 15;
    }

    // 2. Viabilidad y Fricción de Mercado (Weight 25%) - Desacoplado de la etiqueta IA
    let aiFeasibilityScore = 70; // Base neutral
    if (classification.isDisqualified) {
      aiFeasibilityScore = 20;
    } else if (hasProposals) {
      const proposals = Number(input.proposalsCount);
      if (proposals <= 5) {
        aiFeasibilityScore = 100; // Máxima viabilidad: primera línea de atención
      } else if (proposals > 50) {
        aiFeasibilityScore = 15;  // Mercado saturado: fricción crítica
      } else if (proposals > 20) {
        aiFeasibilityScore = 45;  // Competencia moderada/alta
      }
    }

    // 3. Client Quality (Weight 20%)
    let clientQualityScore = 40;
    const spend = input.clientTotalSpend || 0;
    const rating = input.clientRating || 0;

    if (spend >= 100000) clientQualityScore = 75;
    else if (spend >= 25000) clientQualityScore = 65;
    else if (spend >= 5000) clientQualityScore = 55;
    else if (spend >= 500) clientQualityScore = 45;

    // Rating & Verificación
    if (rating >= 4.8) clientQualityScore = Math.min(100, clientQualityScore + 10);
    if (input.isPaymentVerified) {
      clientQualityScore = Math.min(100, clientQualityScore + 5);
    } else {
      clientQualityScore = Math.max(15, clientQualityScore - 25);
    }

    // Evaluación Geográfica
    const country = (input.clientCountry || '').trim().toLowerCase();
    const excluded = (input.excludedCountries || []).map(c => c.trim().toLowerCase()).filter(Boolean);
    const targets = (input.targetCountries || []).map(c => c.trim().toLowerCase()).filter(Boolean);

    const isExcluded = country && excluded.some(exc => country.includes(exc) || exc.includes(country));
    const isTarget = country && targets.length > 0 && targets.some(t => 
      country.includes(t) || t.includes(country) || 
      (t.includes('united states') && (country === 'us' || country === 'usa'))
    );

    if (isTarget) {
      clientQualityScore = Math.min(100, clientQualityScore + 10);
    }

    // 4. Recency Score (Weight 15%)
    let recencyScore = 50; // Neutro si no hay fecha
    if (input.postedDate) {
      const diffHours = Math.max(0, (Date.now() - new Date(input.postedDate).getTime()) / (1000 * 60 * 60));
      if (diffHours <= 2) recencyScore = 100;
      else if (diffHours <= 6) recencyScore = 90;
      else if (diffHours <= 12) recencyScore = 80;
      else if (diffHours <= 24) recencyScore = 70;
      else if (diffHours <= 48) recencyScore = 50;
      else recencyScore = 30;
    }

    // 5. Renormalización Matemática de Pesos Dinámicos
    let totalWeight = 0.40 + 0.25 + 0.20;
    let weightedSum = (skillScore * 0.40) + (aiFeasibilityScore * 0.25) + (clientQualityScore * 0.20);
    
    if (input.postedDate) {
      totalWeight += 0.15;
      weightedSum += (recencyScore * 0.15);
    }

    let overallScore = Math.min(100, Math.round(weightedSum / totalWeight));
    let isCapped = false;
    let capReason: string | null = null;
    let eligibilityStatus: 'ELIGIBLE' | 'PENDING' | 'EXCLUDED' = classification.isDisqualified ? 'EXCLUDED' : 'ELIGIBLE';

    // 6. Inviolabilidad Geográfica
    if (input.geoFilterMode === 'STRICT_EXCLUDE') {
      if (isExcluded) {
        overallScore = 15;
        isCapped = true;
        eligibilityStatus = 'EXCLUDED';
        capReason = `GEO EXCLUDED: Cliente en país prohibido (${input.clientCountry})`;
      } else if (targets.length > 0 && !hasCountry) {
        overallScore = Math.min(44, overallScore);
        isCapped = true;
        eligibilityStatus = 'PENDING';
        capReason = 'GEO PENDING: País desconocido en modo estricto';
      } else if (targets.length > 0 && !isTarget) {
        overallScore = 25;
        isCapped = true;
        eligibilityStatus = 'EXCLUDED';
        capReason = `GEO EXCLUDED: Fuera de países objetivo (${input.clientCountry || 'Desconocido'})`;
      }
    }

    // 7. Safety Cap Inflexible (Si afinidad técnica es insuficiente o está descalificado)
    if (classification.isDisqualified) {
      overallScore = Math.min(44, overallScore);
      isCapped = true;
      capReason = capReason || 'DISQUALIFIED: Tarea operativa o fuera de nicho';
    } else if (skillScore <= 40 && overallScore > 44) {
      overallScore = 44;
      isCapped = true;
      capReason = capReason || 'CAPPED at 44: skill match under 40';
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
      eligibilityStatus,
      dataQualityStatus,
      summaryRationale: `skill ${skillScore} / Feasibility ${aiFeasibilityScore} / client ${clientQualityScore} / recency ${recencyScore} (${dataQualityStatus})`,
      detectedGaps: classification.isDisqualified ? 'Explicitly off-niche task' : 'Review domain specific alignment',
      suggestedProofStory: classification.suggestedProofStory,
    };
  }
}
