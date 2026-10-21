import { Injectable } from '@nestjs/common';

export interface DynamicRoleTaxonomy {
  coreRoles: string[];
  hybridRoles: string[];
  tangentialRoles: string[];
  excludedRoles: string[];
}

export interface SemanticAffinityResult {
  affinityScore: number;       // 10 a 100
  affinityMultiplier: number;  // 0.10 a 1.00
  matchedLane: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED' | 'OFF_NICHE';
  matchedTerm: string | null;
  reason: string;
}

export class TokenWindowMatcher {
  private coreSet = new Set<string>();
  private hybridSet = new Set<string>();
  private tangentialSet = new Set<string>();
  private excludedSet = new Set<string>();

  constructor(taxonomy?: DynamicRoleTaxonomy) {
    if (taxonomy) {
      this.loadTaxonomy(taxonomy);
    }
  }

  public loadTaxonomy(taxonomy: DynamicRoleTaxonomy): void {
    this.coreSet = this.buildNormalizedSet(taxonomy.coreRoles || []);
    this.hybridSet = this.buildNormalizedSet(taxonomy.hybridRoles || []);
    this.tangentialSet = this.buildNormalizedSet(taxonomy.tangentialRoles || []);
    this.excludedSet = this.buildNormalizedSet(taxonomy.excludedRoles || []);
  }

  /**
   * Busca si el texto contiene alguna frase de la categoría dada sin ninguna expresión regular.
   * Ventana deslizante de 4 palabras, 3 palabras, 2 palabras y 1 palabra.
   */
  public findMatch(text: string, category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED'): string | null {
    if (!text) return null;
    const targetSet = this.getSet(category);
    if (targetSet.size === 0) return null;

    const tokens = this.tokenize(text);
    const stemmedTokens = tokens.map(t => this.stem(t));
    const maxWindow = 4;

    for (let windowSize = Math.min(maxWindow, tokens.length); windowSize >= 1; windowSize--) {
      for (let i = 0; i <= tokens.length - windowSize; i++) {
        // 1. Coincidencia exacta de tokens originales
        const phrase = tokens.slice(i, i + windowSize).join(' ');
        if (targetSet.has(phrase)) {
          return phrase;
        }

        // 2. Coincidencia con tokens lematizados / stemmed (ej. "designer" -> "design", "researcher" -> "research")
        const stemmedPhrase = stemmedTokens.slice(i, i + windowSize).join(' ');
        if (targetSet.has(stemmedPhrase)) {
          return phrase;
        }
      }
    }

    return null;
  }

  public stem(word: string): string {
    if (word.length <= 3) return word;
    if (word.endsWith('ers')) return word.slice(0, -3);
    if (word.endsWith('er')) return word.slice(0, -2);
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }

  public tokenize(text: string): string[] {
    const chars: string[] = [];
    const lower = text.toLowerCase();

    for (let i = 0; i < lower.length; i++) {
      const code = lower.charCodeAt(i);
      const isAlphaNum = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
      chars.push(isAlphaNum ? lower[i] : ' ');
    }

    return chars.join('').split(' ').filter(w => w.length > 0);
  }

  private buildNormalizedSet(terms: string[]): Set<string> {
    const set = new Set<string>();
    for (const term of terms) {
      if (!term || typeof term !== 'string') continue;
      const tokens = this.tokenize(term);
      const clean = tokens.join(' ');
      if (clean) set.add(clean);

      // También indexar la versión lematizada en el Set para match bidireccional
      const stemmed = tokens.map(t => this.stem(t)).join(' ');
      if (stemmed && stemmed !== clean) {
        set.add(stemmed);
      }
    }
    return set;
  }

  private getSet(category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED'): Set<string> {
    switch (category) {
      case 'CORE': return this.coreSet;
      case 'HYBRID': return this.hybridSet;
      case 'TANGENTIAL': return this.tangentialSet;
      case 'EXCLUDED': return this.excludedSet;
    }
  }
}

@Injectable()
export class DeterministicSemanticService {
  /**
   * Evalúa la afinidad semántica determinística de la vacante contra la taxonomía del perfil activo.
   * Sin llamadas a IA, 100% en memoria en < 0.1ms.
   */
  public evaluateAffinity(
    title: string,
    description: string,
    skills: string[] = [],
    taxonomy: DynamicRoleTaxonomy
  ): SemanticAffinityResult {
    const matcher = new TokenWindowMatcher(taxonomy);
    const skillsText = Array.isArray(skills) ? skills.join(' ') : '';

    // ── PASO 1: Freno por Rol Excluido en el Título ──────────────────────────
    const excludedInTitle = matcher.findMatch(title, 'EXCLUDED');
    if (excludedInTitle) {
      // Excepción: títulos híbridos explícitos que contienen núcleo (ej. "UI/UX Designer & Full Stack")
      const coreInTitle = matcher.findMatch(title, 'CORE');
      if (!coreInTitle) {
        return {
          affinityScore: 15,
          affinityMultiplier: 0.15,
          matchedLane: 'EXCLUDED',
          matchedTerm: excludedInTitle,
          reason: `Descalificado determinísticamente por rol incompatible: "${excludedInTitle}"`,
        };
      }
    }

    // ── PASO 2: Evaluación por Capas de Autoridad ─────────────────────────────
    let score = 0;
    let matchedLane: SemanticAffinityResult['matchedLane'] = 'OFF_NICHE';
    let matchedTerm: string | null = null;

    // Capa A: El Título manda (60 puntos)
    const coreInTitle = matcher.findMatch(title, 'CORE');
    const hybridInTitle = matcher.findMatch(title, 'HYBRID');
    const tangentialInTitle = matcher.findMatch(title, 'TANGENTIAL');

    if (coreInTitle) {
      score += 60;
      matchedLane = 'CORE';
      matchedTerm = coreInTitle;
    } else if (hybridInTitle) {
      score += 50;
      matchedLane = 'HYBRID';
      matchedTerm = hybridInTitle;
    } else if (tangentialInTitle) {
      score += 24;
      matchedLane = 'TANGENTIAL';
      matchedTerm = tangentialInTitle;
    }

    // Capa B: Skills Oficiales de Upwork (25 puntos)
    const coreInSkills = matcher.findMatch(skillsText, 'CORE');
    const hybridInSkills = matcher.findMatch(skillsText, 'HYBRID');
    const tangentialInSkills = matcher.findMatch(skillsText, 'TANGENTIAL');

    if (coreInSkills) {
      score += 25;
      matchedTerm = matchedTerm || coreInSkills;
      if (matchedLane === 'OFF_NICHE') matchedLane = 'CORE';
    } else if (hybridInSkills) {
      score += 20;
      matchedTerm = matchedTerm || hybridInSkills;
      if (matchedLane === 'OFF_NICHE') matchedLane = 'HYBRID';
    } else if (tangentialInSkills) {
      score += 10;
      matchedTerm = matchedTerm || tangentialInSkills;
      if (matchedLane === 'OFF_NICHE') matchedLane = 'TANGENTIAL';
    }

    // Capa C: Descripción de Contexto (15 puntos)
    const coreInDesc = matcher.findMatch(description, 'CORE');
    const hybridInDesc = matcher.findMatch(description, 'HYBRID');

    if (coreInDesc) {
      score += 15;
    } else if (hybridInDesc) {
      score += 12;
    }

    const affinityScore = Math.min(100, Math.max(10, score));
    const affinityMultiplier = Number((affinityScore / 100).toFixed(2));

    return {
      affinityScore,
      affinityMultiplier,
      matchedLane,
      matchedTerm,
      reason: matchedTerm
        ? `Afinidad detectada con "${matchedTerm}" en categoría ${matchedLane}`
        : 'Sin coincidencia clara con la taxonomía del perfil',
    };
  }
}
