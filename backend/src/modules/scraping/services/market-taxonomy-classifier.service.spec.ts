import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MarketTaxonomyClassifierService,
  TaxonomyFallbackUnavailableError,
} from './market-taxonomy-classifier.service';

const rules = [
  {
    id: 'design-systems',
    slug: 'design-systems',
    metadata: { classification: { includeTerms: ['design system', 'design tokens', 'component library'] } },
  },
  {
    id: 'ux-research',
    slug: 'ux-research',
    metadata: { classification: { includeTerms: ['ux research', 'usability testing', 'user interviews'] } },
  },
  {
    id: 'other-services',
    slug: 'other-services',
    metadata: { fallback: true, classification: { includeTerms: [] } },
  },
];

test('classifies a job using taxonomy metadata rather than category-specific code', () => {
  const service = new MarketTaxonomyClassifierService();
  const result = service.classify({
    title: 'Senior Design System consultant',
    description: 'Create a component library and design tokens for our SaaS product.',
    skills: ['Figma'],
  }, rules);

  assert.ok(result);
  assert.equal(result.taxonomyNodeId, 'design-systems');
  assert.deepEqual(result.evidence.matchedTerms, ['design system', 'design tokens', 'component library']);
  assert.ok(result.confidence > 0.9);
});

test('returns a deterministic low-confidence fallback when taxonomy signals do not match', () => {
  const service = new MarketTaxonomyClassifierService();
  const result = service.classify({
    title: 'Bookkeeper needed',
    description: 'Monthly financial reconciliation.',
    skills: ['Accounting'],
  }, rules);

  assert.ok(result);
  assert.equal(result.taxonomyNodeId, 'other-services');
  assert.equal(result.confidence, 0.1);
  assert.deepEqual(result.evidence, {
    matchedTerms: [],
    matchedFields: [],
    fallbackReason: 'no-rule-match',
  });
});

test('normalizes source text before deterministic matching', () => {
  const service = new MarketTaxonomyClassifierService();
  const result = service.classify({
    title: 'FIGMA — DESIGN SYSTEM!!!',
    description: '',
    skills: [],
  }, rules);

  assert.equal(result.taxonomyNodeId, 'design-systems');
  assert.deepEqual(result.evidence.matchedTerms, ['design system']);
});

test('fails explicitly instead of silently succeeding when the fallback rule is unavailable', () => {
  const service = new MarketTaxonomyClassifierService();

  assert.throws(() => service.classify({
    title: 'Bookkeeper needed',
    description: 'Monthly financial reconciliation.',
    skills: ['Accounting'],
  }, rules.filter((rule) => rule.slug !== 'other-services')), TaxonomyFallbackUnavailableError);
});
