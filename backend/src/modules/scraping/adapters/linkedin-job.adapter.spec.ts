import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BudgetType } from '@prisma/client';
import { LinkedInJobAdapter } from './linkedin-job.adapter';

describe('LinkedInJobAdapter - Unit Test Suite', () => {
  const mockApifyService: any = {
    runLinkedInScraper: async () => [],
  };

  const adapter = new LinkedInJobAdapter(mockApifyService);

  it('should normalize a full LinkedIn Apify payload into a canonical NormalizedJob with source LINKEDIN and direct applyUrl', () => {
    const rawLinkedInPayload = {
      id: '401928374',
      title: 'Senior AI UX & Full Stack Engineer',
      companyName: 'NextGen AI Labs',
      description: 'We are seeking an experienced Senior AI UX Engineer to design and build agentic user flows.',
      applyUrl: 'https://boards.greenhouse.io/nextgen/jobs/401928374',
      jobUrl: 'https://www.linkedin.com/jobs/view/401928374',
      location: 'New York, NY (Remote)',
      salaryRange: '$150,000 - $180,000 / yr',
      postedDate: '2026-10-25T12:00:00.000Z',
      skills: ['TypeScript', 'Angular', 'NestJS', 'AI Prototyping'],
    };

    const normalized = adapter.normalizeRaw(rawLinkedInPayload);

    assert.strictEqual(normalized.source, 'LINKEDIN');
    assert.strictEqual(normalized.externalId, '401928374');
    assert.strictEqual(normalized.title, 'Senior AI UX & Full Stack Engineer');
    assert.strictEqual(normalized.companyName, 'NextGen AI Labs');
    assert.strictEqual(normalized.jobUrl, 'https://boards.greenhouse.io/nextgen/jobs/401928374', 'Direct ATS applyUrl must be prioritized over generic LinkedIn link');
    assert.strictEqual(normalized.clientCountry, 'United States');
    assert.strictEqual(normalized.budgetType, BudgetType.FIXED);
    assert.strictEqual(normalized.budgetFixed, 150000);
    assert.strictEqual(normalized.postedAtKnown, true);
    assert.deepStrictEqual(normalized.skills, ['TypeScript', 'Angular', 'NestJS', 'AI Prototyping']);
  });

  it('should gracefully handle missing salary, partial locations, and null applyUrl using safe fallbacks', () => {
    const rawIncompletePayload = {
      jobId: '987654321',
      title: 'Product Designer',
      company: 'Stealth Startup',
      jobDescription: 'Looking for a product designer.',
      link: 'https://www.linkedin.com/jobs/view/987654321',
      location: 'Remote',
    };

    const normalized = adapter.normalizeRaw(rawIncompletePayload);

    assert.strictEqual(normalized.source, 'LINKEDIN');
    assert.strictEqual(normalized.externalId, '987654321');
    assert.strictEqual(normalized.companyName, 'Stealth Startup');
    assert.strictEqual(normalized.jobUrl, 'https://www.linkedin.com/jobs/view/987654321');
    assert.strictEqual(normalized.budgetType, BudgetType.NOT_SHOWN);
    assert.strictEqual(normalized.budgetFixed, null);
    assert.strictEqual(normalized.hourlyMin, null);
    assert.strictEqual(normalized.proposalsCountKnown, false);
    assert.strictEqual(normalized.isPaymentVerified, false);
  });
});
