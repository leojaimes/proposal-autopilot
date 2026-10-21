import { Injectable, Logger } from '@nestjs/common';
import { RoleClassifierService } from './role-classifier.service';
import { DeterministicSemanticService, DynamicRoleTaxonomy } from './deterministic-semantic.service';
import { StrategicLane } from '../constants/taxonomy.constants';

export interface FitCalculationInput {
  title: string;
  description: string;
  skills?: string[];
  activeQueries?: string[];
  taxonomy?: DynamicRoleTaxonomy;
  clientCountry?: string;
  clientTotalSpend?: number;
  clientRating?: number;
  proposalsCount?: number | null;
  isPaymentVerified?: boolean;
  postedDate?: Date | string | null;
  excludedCountries?: string[];
  targetCountries?: string[];
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
  suggestedProofStory: string | null;
  drivers: string[];
  drags: string[];
}

@Injectable()
export class FitCalculatorService {
  private readonly logger = new Logger(FitCalculatorService.name);

  constructor(
    private readonly roleClassifier: RoleClassifierService,
    private readonly semanticService: DeterministicSemanticService = new DeterministicSemanticService(),
  ) {}

  /**
   * Cálculo Determinista Deductivo (Arranca en el potencial del rol y descuenta por fricciones).
   * Cero suposiciones en código: se guía por activeQueries del Calibrador de la base de datos.
   */
  calculate(input: FitCalculationInput): FitScoreOutput {
    const drivers: string[] = [];
    const drags: string[] = [];

    // 1. Evaluación de Coincidencia contra las Expresiones Activas del Calibrador
    const match = this.roleClassifier.evaluateMatch(
      input.title,
      input.description,
      input.skills || [],
      input.activeQueries || [],
    );

    const baseFitScore = match.baseFitScore;
    if (match.matchLevel === 'DIRECT_MATCH') {
      drivers.push(match.reason);
    } else if (match.matchLevel === 'PARTIAL_MATCH') {
      drivers.push(match.reason);
    } else {
      drags.push(match.reason);
    }

    let deductions = 0;

    // 2. Fricción por Competencia (Propuestas Enviadas)
    let aiFeasibilityScore = 80;
    if (input.proposalsCount != null) {
      const count = input.proposalsCount;
      if (count <= 5) {
        drivers.push(`Baja competencia: ${count} propuestas (primeros en aplicar)`);
        aiFeasibilityScore = 100;
      } else if (count <= 15) {
        deductions += 5;
        drags.push(`Competencia moderada: ${count} propuestas (-5 pts)`);
        aiFeasibilityScore = 85;
      } else if (count <= 50) {
        deductions += 15;
        drags.push(`Competencia alta: ${count} propuestas (-15 pts)`);
        aiFeasibilityScore = 55;
      } else {
        deductions += 30;
        drags.push(`Mercado saturado: ${count} propuestas (-30 pts)`);
        aiFeasibilityScore = 20;
      }
    }

    // 3. Fricción por Solvencia y Reputación del Cliente
    let clientQualityScore = 70;
    if (input.isPaymentVerified === false) {
      deductions += 20;
      drags.push('Método de pago no verificado (-20 pts)');
      clientQualityScore = 30;
    } else {
      drivers.push('Método de pago verificado');
      clientQualityScore = 85;
    }

    const spend = input.clientTotalSpend ?? 0;
    const rating = input.clientRating ?? 0;

    if (spend >= 10000) {
      drivers.push(`Cliente solvente ($${Math.round(spend).toLocaleString()} gastados)`);
      clientQualityScore = Math.min(100, clientQualityScore + 15);
    } else if (spend === 0) {
      if (input.isPaymentVerified && rating >= 4.5) {
        deductions += 5;
        drags.push('Cliente nuevo con pago verificado (-5 pts)');
      } else {
        deductions += 15;
        drags.push('Cliente sin historial previo de contratación (-15 pts)');
      }
    } else if (spend < 1000) {
      deductions += 5;
      drags.push('Gasto histórico bajo (< $1,000, -5 pts)');
    }

    if (rating > 0 && rating < 4.5) {
      deductions += 10;
      drags.push(`Rating del cliente bajo (${rating.toFixed(1)} estrellas, -10 pts)`);
    }

    // 4. Frescura de Publicación (Priorizando 100% el Match de Perfil sobre la Fecha)
    // Cero penalizaciones a la afinidad del perfil por días transcurridos
    let recencyScore = 85;
    if (input.postedDate != null) {
      const postedTime = new Date(input.postedDate).getTime();
      const diffHours = Math.max(0, (Date.now() - postedTime) / (1000 * 3600));

      if (diffHours < 3) {
        drivers.push('Publicación muy reciente (< 3 horas, ventaja primer postor)');
        recencyScore = 100;
      } else if (diffHours <= 24) {
        recencyScore = 95;
      } else if (diffHours <= 72) {
        recencyScore = 90;
      } else if (diffHours <= 168) {
        recencyScore = 85;
      } else if (diffHours <= 504) {
        recencyScore = 75;
      } else {
        recencyScore = 60;
      }
    }

    // 5. Cálculo Nominal Deductivo (Piso de 15 para evitar ceros artificiales)
    let overallScore = Math.max(15, Math.min(100, baseFitScore - deductions));

    // 5.1 Eje Bi-Axial de Afinidad Semántica (Multiplicador de Relevancia de Rol)
    if (input.taxonomy) {
      const affinity = this.semanticService.evaluateAffinity(
        input.title,
        input.description,
        input.skills || [],
        input.taxonomy
      );

      if (affinity.matchedLane === 'EXCLUDED') {
        overallScore = Math.min(15, Math.round(overallScore * affinity.affinityMultiplier));
        drags.push(affinity.reason);
      } else {
        overallScore = Math.max(15, Math.min(100, Math.round(overallScore * affinity.affinityMultiplier)));
        if (affinity.affinityMultiplier >= 0.70) {
          drivers.push(`Afinidad de Rol: ${affinity.matchedLane} (${Math.round(affinity.affinityMultiplier * 100)}%)`);
        } else {
          drags.push(`Afinidad de Rol moderada: ${affinity.matchedLane} (${Math.round(affinity.affinityMultiplier * 100)}%)`);
        }
      }
    }

    // 6. Calidad de Datos
    const dataQualityStatus: 'COMPLETE' | 'INCOMPLETE' =
      (input.proposalsCount != null && input.postedDate != null) ? 'COMPLETE' : 'INCOMPLETE';

    if (dataQualityStatus === 'INCOMPLETE' && overallScore > 90) {
      overallScore = 88; // No regalar 100 perfecto si faltan propuestas o fecha
      drags.push('Datos incompletos de Apify: fecha o propuestas no reportadas');
    }

    // 7. Filtro Geográfico y Techos de Seguridad (Caps)
    let eligibilityStatus: 'ELIGIBLE' | 'PENDING' | 'EXCLUDED' = 'ELIGIBLE';
    let isCapped = false;
    let capReason: string | null = null;

    const excluded = (input.excludedCountries || []).map(c => c.toLowerCase().trim());
    const countryLower = (input.clientCountry || '').toLowerCase().trim();
    if (countryLower && excluded.includes(countryLower)) {
      overallScore = Math.min(15, overallScore);
      eligibilityStatus = 'EXCLUDED';
      isCapped = true;
      capReason = `GEO EXCLUDED: Fuera de países permitidos (${input.clientCountry})`;
      drags.push(capReason);
    }

    if (match.isIncompatible) {
      overallScore = Math.min(25, overallScore);
      isCapped = true;
      capReason = capReason || 'INCOMPATIBLE: Rol de asistencia o soporte ajeno al perfil';
    } else if (match.matchLevel === 'OFF_NICHE' || match.isDisqualified) {
      overallScore = Math.min(35, overallScore);
      isCapped = true;
      capReason = capReason || 'OFF_NICHE: Sin coincidencia con las expresiones activas del motor';
    }

    if (input.taxonomy) {
      const affinity = this.semanticService.evaluateAffinity(
        input.title,
        input.description,
        input.skills || [],
        input.taxonomy
      );
      if (affinity.matchedLane === 'EXCLUDED') {
        overallScore = Math.min(15, overallScore);
        isCapped = true;
        capReason = capReason || affinity.reason;
      }
    }

    const fitTier: 'HIGH' | 'MEDIUM' | 'LOW' =
      overallScore >= 75 ? 'HIGH' : overallScore >= 45 ? 'MEDIUM' : 'LOW';

    return {
      overallScore,
      fitTier,
      strategicLane: match.lane,
      normalizedRole: match.normalizedRole,
      skillScore: baseFitScore,
      aiFeasibilityScore,
      clientQualityScore,
      recencyScore,
      isCapped,
      capReason,
      eligibilityStatus,
      dataQualityStatus,
      summaryRationale: `Base ${baseFitScore} - Deducciones ${deductions} pts (${dataQualityStatus})`,
      detectedGaps: match.isDisqualified ? match.reason : 'Revisar detalles en la descripción del cliente',
      suggestedProofStory: null, // Cero nombres inventados
      drivers,
      drags,
    };
  }
}
