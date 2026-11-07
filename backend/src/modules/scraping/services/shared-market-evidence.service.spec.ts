import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SharedMarketEvidenceService } from './shared-market-evidence.service';

test('aggregates shared market evidence by category', async () => {
  const service = new SharedMarketEvidenceService({
    sharedUpworkJob: {
      findMany: async () => [
        { postedAt: new Date('2026-11-06T02:00:00.000Z'), segments: [{ segment: 'social-media-content' }] },
        { postedAt: new Date('2026-11-07T15:00:00.000Z'), segments: [{ segment: 'social-media-content' }] },
        { postedAt: new Date('2026-11-06T08:00:00.000Z'), segments: [{ segment: 'design-systems' }] },
      ],
    },
    marketRadarCoveragePage: {
      findMany: async () => [
        { segment: 'social-media-content', outputCursor: 'next-page' },
        { segment: 'design-systems', outputCursor: null },
      ],
    },
  } as never);

  assert.deepEqual(await service.list(), [
    {
      segment: 'design-systems',
      sampleJobs: 1,
      oldestPostedAt: new Date('2026-11-06T08:00:00.000Z'),
      newestPostedAt: new Date('2026-11-06T08:00:00.000Z'),
      coverage: 'COMPLETE',
    },
    {
      segment: 'social-media-content',
      sampleJobs: 2,
      oldestPostedAt: new Date('2026-11-06T02:00:00.000Z'),
      newestPostedAt: new Date('2026-11-07T15:00:00.000Z'),
      coverage: 'PARTIAL',
    },
  ]);
});
