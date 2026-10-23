import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketTaxonomyClassifierService } from './market-taxonomy-classifier.service';

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

test('returns no assignment when configurable taxonomy signals do not match', () => {
  const service = new MarketTaxonomyClassifierService();
  const result = service.classify({
    title: 'Bookkeeper needed',
    description: 'Monthly financial reconciliation.',
    skills: ['Accounting'],
  }, rules);

  assert.equal(result, null);
});
