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

    // 2. Coincidencia Flexible con Expresiones Activas del Motor
    let directMatchedQuery: string | null = null;
    let partialMatchedQuery: string | null = null;

    for (const query of activeQueries) {
      if (!query || query.trim().length === 0) continue;
      const queryLower = query.toLowerCase().trim();

      // Tokenizar las palabras clave de la query (mínimo 2 letras)
      const tokens = queryLower.split(/\s+/).filter(t => t.length >= 2);
      if (tokens.length === 0) continue;

      // Stemming simple para variaciones comunes (design/designer, prototype/prototyping, etc.)
      const normalizeToken = (t: string) => {
        if (t.startsWith('design')) return 'design';
        if (t.startsWith('prototyp')) return 'prototyp';
        if (t.startsWith('agent')) return 'agent';
        if (t.startsWith('researc')) return 'researc';
        if (t.startsWith('usabilit')) return 'usabilit';
        if (t.startsWith('system')) return 'system';
        return t;
      };

      const normalizedTokens = tokens.map(normalizeToken);

      // Comprobar si TODOS los tokens de la query aparecen en el TÍTULO (en cualquier orden)
      const titleMatchesAll = normalizedTokens.every(tok => titleLower.includes(tok));
      if (titleMatchesAll) {
        directMatchedQuery = query;
        break; // Máxima prioridad: match directo en título
      }

      // Si no en título, comprobar en el texto completo o skills
      const fullMatchesAll = normalizedTokens.every(tok => allText.includes(tok));
      if (fullMatchesAll && !partialMatchedQuery) {
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
