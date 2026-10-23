export interface TaxonomyClassificationRule {
  id: string;
  slug: string;
  metadata: unknown;
}

export interface TaxonomyClassificationInput {
  title: string;
  description: string;
  skills: string[];
}

export interface TaxonomyClassificationResult {
  taxonomyNodeId: string;
  confidence: number;
  evidence: {
    matchedTerms: string[];
    matchedFields: Array<'title' | 'description' | 'skills'>;
  };
}

interface ClassificationMetadata {
  classification?: {
    includeTerms?: string[];
  };
}

const normalize = (value: string): string => value
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/gu, ' ');

const includesTerm = (value: string, term: string): boolean => (
  ` ${value} `.includes(` ${term} `)
);

/**
 * Ranks taxonomy nodes from configurable signals persisted in taxonomy metadata.
 * It deliberately knows no market-category names, so taxonomy updates do not
 * require a controller deployment.
 */
export class MarketTaxonomyClassifierService {
  classify(
    input: TaxonomyClassificationInput,
    rules: TaxonomyClassificationRule[],
  ): TaxonomyClassificationResult | null {
    const fields = {
      title: normalize(input.title),
      description: normalize(input.description),
      skills: normalize(input.skills.join(' ')),
    } as const;

    const candidates = rules.map((rule) => {
      const metadata = (rule.metadata || {}) as ClassificationMetadata;
      const includeTerms = (metadata.classification?.includeTerms || [])
        .map(normalize)
        .filter(Boolean);
      const matchedTerms = includeTerms.filter((term) => (
        Object.values(fields).some((field) => includesTerm(field, term))
      ));
      const matchedFields = (Object.entries(fields) as Array<[keyof typeof fields, string]>)
        .filter(([, field]) => matchedTerms.some((term) => includesTerm(field, term)))
        .map(([field]) => field);

      return { rule, includeTerms, matchedTerms, matchedFields };
    }).filter((candidate) => candidate.matchedTerms.length > 0);

    if (candidates.length === 0) return null;

    candidates.sort((left, right) => (
      right.matchedTerms.length - left.matchedTerms.length
      || right.matchedFields.length - left.matchedFields.length
      || left.rule.slug.localeCompare(right.rule.slug)
    ));

    const winner = candidates[0];
    const matchRatio = winner.matchedTerms.length / winner.includeTerms.length;
    const confidence = Math.min(0.95, Number((0.5 + (matchRatio * 0.45)).toFixed(4)));

    return {
      taxonomyNodeId: winner.rule.id,
      confidence,
      evidence: {
        matchedTerms: winner.matchedTerms,
        matchedFields: winner.matchedFields,
      },
    };
  }
}
