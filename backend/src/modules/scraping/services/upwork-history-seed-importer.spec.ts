import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { UpworkHistorySeedImporter } from './upwork-history-seed-importer';

test('imports the most recent Apify rows into a protected shared-catalog repository', async () => {
  let receivedLimit: unknown;
  let savedRows: unknown;
  let savedProvenance: unknown;
  const importer = new UpworkHistorySeedImporter(
    {
      async getMostRecent(input: unknown) {
        receivedLimit = input;
        return {
          runId: 'apify-run-1',
          datasetId: 'dataset-1',
          items: [{
            id: '021929210319849117903',
            url: 'https://www.upwork.com/jobs/~021929210319849117903',
            postedAt: '2025-08-05T00:28:33Z',
            title: 'Older UI UX Designer',
            description: 'Design a product interface with Figma.',
            jobType: 'hourly',
            hourlyMin: 15,
            hourlyMax: 35,
            skills: ['Figma', 'UX & UI Design'],
            clientCountry: 'Canada',
            clientPaymentVerified: true,
            clientTotalSpentAtPosting: 15737.82,
          }, {
            id: '021929210319849117904',
            url: 'https://www.upwork.com/jobs/~021929210319849117904',
            postedAt: '2026-08-05T00:28:33Z',
            title: 'Newest UI UX Designer',
            description: 'Design a product interface with Figma.',
            jobType: 'hourly',
            hourlyMin: 20,
            hourlyMax: 40,
            skills: ['Figma'],
            clientCountry: 'Canada',
            clientPaymentVerified: true,
            clientTotalSpentAtPosting: 17000,
          }],
        };
      },
    },
    {
      async hasCompletedProtectedSeed() { return false; },
      async saveProtected(rows: unknown, provenance: unknown) {
        savedRows = rows;
        savedProvenance = provenance;
      },
    },
  );

  const result = await importer.importOnce();

  assert.equal(receivedLimit, 1000);
  assert.deepEqual(result, { imported: 2, runId: 'apify-run-1', datasetId: 'dataset-1' });
  assert.deepEqual(savedRows, [{
    externalUpworkId: '021929210319849117904',
    jobUrl: 'https://www.upwork.com/jobs/~021929210319849117904',
    postedAt: new Date('2026-08-05T00:28:33Z'),
    title: 'Newest UI UX Designer',
    description: 'Design a product interface with Figma.',
    budgetType: 'HOURLY',
    hourlyMin: 20,
    hourlyMax: 40,
    skills: ['Figma'],
    clientCountry: 'Canada',
    isPaymentVerified: true,
    clientTotalSpend: 17000,
    isProtected: true,
  }, {
    externalUpworkId: '021929210319849117903',
    jobUrl: 'https://www.upwork.com/jobs/~021929210319849117903',
    postedAt: new Date('2025-08-05T00:28:33Z'),
    title: 'Older UI UX Designer',
    description: 'Design a product interface with Figma.',
    budgetType: 'HOURLY',
    hourlyMin: 15,
    hourlyMax: 35,
    skills: ['Figma', 'UX & UI Design'],
    clientCountry: 'Canada',
    isPaymentVerified: true,
    clientTotalSpend: 15737.82,
    isProtected: true,
  }]);
  assert.deepEqual(savedProvenance, {
    actorId: 'hyperbach/upwork-jobs-history',
    runId: 'apify-run-1',
    datasetId: 'dataset-1',
  });
});

test('skips the Apify request when a completed protected seed already exists', async () => {
  const importer = new UpworkHistorySeedImporter(
    { async getMostRecent() { throw new Error('Apify must not be called'); } },
    {
      async hasCompletedProtectedSeed() { return true; },
      async saveProtected() { throw new Error('The catalog must not be changed'); },
    },
  );

  assert.deepEqual(await importer.importOnce(), { imported: 0, skipped: true });
});
