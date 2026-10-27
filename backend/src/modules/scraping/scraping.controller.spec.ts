import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { needsTaxonomyReprocessing, resolveJobPlatform } from './scraping.controller';

test('reprocesses jobs without a primary taxonomy assignment', () => {
  assert.equal(needsTaxonomyReprocessing(undefined), true);
});

test('reprocesses jobs with a primary assignment from an older classifier', () => {
  assert.equal(needsTaxonomyReprocessing({ classifierVersion: 'v1' }), true);
});

test('skips jobs with a current primary taxonomy assignment', () => {
  assert.equal(needsTaxonomyReprocessing({ classifierVersion: 'taxonomy-rules-v1' }), false);
});

test('resolves UPWORK as default platform for standard Upwork externalId', () => {
  const platform = resolveJobPlatform({ externalUpworkId: '~01abc987654321', rawApifyPayload: {} });
  assert.equal(platform, 'UPWORK');
});

test('resolves LINKEDIN platform when externalId has li: prefix or payload has _platform LINKEDIN', () => {
  assert.equal(resolveJobPlatform({ externalUpworkId: 'li:401928374' }), 'LINKEDIN');
  assert.equal(resolveJobPlatform({ externalUpworkId: 'random-id', rawApifyPayload: { _platform: 'LINKEDIN' } }), 'LINKEDIN');
});
