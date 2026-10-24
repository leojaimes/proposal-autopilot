import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { needsTaxonomyReprocessing } from './scraping.controller';

test('reprocesses jobs without a primary taxonomy assignment', () => {
  assert.equal(needsTaxonomyReprocessing(undefined), true);
});

test('reprocesses jobs with a primary assignment from an older classifier', () => {
  assert.equal(needsTaxonomyReprocessing({ classifierVersion: 'v1' }), true);
});

test('skips jobs with a current primary taxonomy assignment', () => {
  assert.equal(needsTaxonomyReprocessing({ classifierVersion: 'taxonomy-rules-v1' }), false);
});
