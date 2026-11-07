import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { needsTaxonomyReprocessing, resolveJobPlatform, ScrapingController } from './scraping.controller';

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

test('resolves direct application (LINKEDIN style) when externalId has ext: prefix or payload has _platform CUSTOM', () => {
  assert.equal(resolveJobPlatform({ externalUpworkId: 'ext:171829384:abc' }), 'LINKEDIN');
  assert.equal(resolveJobPlatform({ externalUpworkId: 'custom-id', rawApifyPayload: { _platform: 'CUSTOM' } }), 'LINKEDIN');
});

test('returns shared market evidence independently of tenant snapshots', async () => {
  const controller = Object.assign(Object.create(ScrapingController.prototype), {
    tenantContext: { getTenantId: () => 'tenant-1' },
    resolveActiveProfile: async () => null,
    marketTrendCalculator: { calculate: () => new Map() },
    marketRadarOperations: { getHealth: async () => ({ latestSnapshotAsOf: null, latestCompletedScrapeAt: null }) },
    prisma: {
      marketCategorySnapshot: { findMany: async () => [] },
      marketRadarDecision: { findMany: async () => [] },
      sharedUpworkJob: {
        findMany: async () => [
          { postedAt: new Date('2026-11-06T02:00:00.000Z'), segments: [{ segment: 'social-media-content' }] },
        ],
      },
      marketRadarCoveragePage: {
        findMany: async () => [{ segment: 'social-media-content', outputCursor: 'next-page' }],
      },
    },
  }) as ScrapingController;

  const result = await controller.getPersistedMarketRadar();

  assert.deepEqual(result.data.categories, []);
  assert.deepEqual(result.data.sharedMarketEvidence, [{
    segment: 'social-media-content',
    sampleJobs: 1,
    oldestPostedAt: new Date('2026-11-06T02:00:00.000Z'),
    newestPostedAt: new Date('2026-11-06T02:00:00.000Z'),
    coverage: 'PARTIAL',
  }]);
});
