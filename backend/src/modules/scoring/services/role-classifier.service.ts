import { Injectable, Logger } from '@nestjs/common';
import { StrategicLane, RoleClassification } from '../constants/taxonomy.constants';

export interface PositioningProfileContext {
  offerHeadline: string;
  targetAudience: string;
  proofStories?: Array<{
    keyCode?: string;
    companyOrProduct: string;
    impactMetric: string;
    domainTags: string[];
  }>;
}

export interface MatchEvaluation {
  matchLevel: 'DIRECT_MATCH' | 'PARTIAL_MATCH' | 'OFF_NICHE' | 'INCOMPATIBLE_ROLE';
  matchedQuery: string | null;
  baseFitScore: number;
  normalizedRole: string;
  lane: StrategicLane;
  isDisqualified: boolean;
  isIncompatible: boolean;
  reason: string;
}

@Injectable()
export class RoleClassifierService {
  private readonly logger = new Logger(RoleClassifierService.name);

  /**
   * Evaluador Flexible de Afinidad contra las Expresiones Activas del Calibrador (searchKeywords).
   * Tokeniza términos para emparejar sin importar el orden (ej. 'Product Designer (AI)' empareja con 'AI product design').
   */
  evaluateMatch(
    title: string,
    description: string,
    skills: string[] = [],
    activeQueries: string[] = [],
  ): MatchEvaluation {
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    const allText = `${titleLower} ${descLower} ${skills.join(' ').toLowerCase()}`;

    // 1. Detección de Roles Incompatibles / Asistencia / Soporte (Filtro Sujeto vs. Objeto)
    const assistantRegex = /\b(assistant|virtual assistant|reverse recruiter|recruiter assistant|job application assistant|job search assistant|data entry|clerk|telemarketer|cold caller|appointment setter)\b/i;
    if (assistantRegex.test(titleLower)) {
      return {
        matchLevel: 'INCOMPATIBLE_ROLE',
        matchedQuery: null,
        baseFitScore: 20,
        normalizedRole: 'Disqualified / Administrative Support Task',
        lane: StrategicLane.DISQUALIFIED_NOISE,
        isDisqualified: true,
        isIncompatible: true,
        reason: 'El título corresponde a un rol de asistencia o soporte administrativo ajeno al perfil',
      };
    }

    // 2. Detección de Dominios Físicos, Inmobiliarios o Hardware Ajenos a UI/UX (Solar, CAD Eléctrico, etc.)
    const incompatibleDomainsRegex = /\b(solar|photovoltaic|electrical\s+(?:design|engineer|drawing|panel|permit)|hvac|plumbing|civil\s+engineer|structural\s+engineer|cnc|microfluidic|jewelry|cad\/cam|autocad\s+(?:permit|dwg|wiring)|pcb\s+layout|hardware\s+engineer|real\s+estate\s+(?:agent|listing|broker)|property\s+manag|leasing\s+agent|realtor|head\s+of\s+listings)\b/i;
    if (incompatibleDomainsRegex.test(titleLower)) {
      return {
        matchLevel: 'INCOMPATIBLE_ROLE',
        matchedQuery: null,
        baseFitScore: 20,
        normalizedRole: 'Disqualified / Non-Digital Domain (Physical/Engineering/Real Estate)',
        lane: StrategicLane.DISQUALIFIED_NOISE,
        isDisqualified: true,
        isIncompatible: true,
        reason: 'El título corresponde a un dominio físico o industrial ajeno al diseño de producto digital',
      };
    }

    // 3. Constructor de Expresión Regular Estricta con Límites de Palabra (\b)
    const buildQueryRegex = (q: string): RegExp => {
      const clean = q.toLowerCase().replace(/[\/\-_]/g, ' ').trim();
      if (/design\s*system/.test(clean)) return /\bdesign\s+systems?\b|\bsystems?\s+design\b/i;
      if (/ux\s*research/.test(clean)) return /\b(?:ux|user)\s+research(?:er|ing)?\b/i;
      if (/ui\s*ux/.test(clean) || /ux\s*ui/.test(clean)) return /\b(?:ui\s*[\/\-]?\s*ux|ux\s*[\/\-]?\s*ui|ui\s+ux|ux\s+ui)\b/i;
      if (/usability\s*test/.test(clean)) return /\busability\s+test(?:ing)?\b/i;
      if (/vibe\s*coding/.test(clean)) return /\bvibe\s+coding\b/i;
      if (/agentic/.test(clean)) return /\bagentic(?:\s+workflows?)?\b/i;
      if (/ai\s*product\s*design/.test(clean)) return /\b(?:ai\s+product\s+design|product\s+designer\s*\(?ai\)?|ai\s+(?:ux|ui))\b/i;
      if (/ai\s*prototyp/.test(clean)) return /\bai\s+prototyp(?:e|ing|er)\b/i;
      if (clean === 'figma') return /\bfigma\b/i;
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      const pattern = words.map(w => '\\b' + w).join('\\s+');
      return new RegExp(pattern, 'i');
    };

    // 4. Coincidencia Fraseológica con Expresiones Activas del Motor
    let directMatchedQuery: string | null = null;
    let partialMatchedQuery: string | null = null;

    for (const query of activeQueries) {
      const qRegex = buildQueryRegex(query);

      // Comprobar coincidencia exacta en TÍTULO
      if (qRegex.test(title)) {
        directMatchedQuery = query;
        break; // Máxima prioridad
      }

      // Si no en título, comprobar en la descripción o skills
      if (!partialMatchedQuery && (qRegex.test(description) || skills.some(s => qRegex.test(s)))) {
        partialMatchedQuery = query;
      }
    }

    // Si hubo coincidencia directa en el título
    if (directMatchedQuery) {
      return {
        matchLevel: 'DIRECT_MATCH',
        matchedQuery: directMatchedQuery,
        baseFitScore: 100,
        normalizedRole: title.slice(0, 50),
        lane: StrategicLane.CORE_AI_UX,
        isDisqualified: false,
        isIncompatible: false,
        reason: `Coincidencia directa con la expresión activa: "${directMatchedQuery}"`,
      };
    }

    // Si hubo coincidencia parcial en skills o descripción
    if (partialMatchedQuery) {
      return {
        matchLevel: 'PARTIAL_MATCH',
        matchedQuery: partialMatchedQuery,
        baseFitScore: 80,
        normalizedRole: title.slice(0, 50),
        lane: StrategicLane.INTERFACE_BUILD,
        isDisqualified: false,
        isIncompatible: false,
        reason: `Coincidencia secundaria con la expresión activa: "${partialMatchedQuery}"`,
      };
    }

    // 3. Si no coincide con ninguna expresión activa de la base de datos
    return {
      matchLevel: 'OFF_NICHE',
      matchedQuery: null,
      baseFitScore: 30,
      normalizedRole: title.slice(0, 50),
      lane: StrategicLane.DISQUALIFIED_NOISE,
      isDisqualified: true,
      isIncompatible: false,
      reason: 'No coincide con las expresiones de búsqueda configuradas en el perfil',
    };
  }

  /**
   * Clasificador Heurístico (Compatibilidad con llamadas legacy)
   */
  classify(title: string, description: string, skills: string[] = []): RoleClassification {
    const evaluation = this.evaluateMatch(title, description, skills, []);
    return {
      lane: evaluation.lane,
      normalizedRole: evaluation.normalizedRole,
      suggestedProofStory: null, // Cero hardcodeo
      isDisqualified: evaluation.isDisqualified,
    };
  }
}
