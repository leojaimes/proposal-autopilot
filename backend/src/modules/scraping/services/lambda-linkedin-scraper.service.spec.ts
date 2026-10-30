import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { LambdaLinkedInScraperService } from './lambda-linkedin-scraper.service';

describe('LambdaLinkedInScraperService - Unit Test Suite', () => {
  it('should format payload correctly and invoke LambdaClient', async () => {
    const service = new LambdaLinkedInScraperService();

    // Mock send method
    (service as any).lambdaClient = {
      send: async (command: any) => {
        const payload = JSON.parse(Buffer.from(command.input.Payload).toString('utf-8'));
        assert.strictEqual(payload.action, 'SCRAPE_LINKEDIN_JOBS');
        assert.deepStrictEqual(payload.keywords, ['React', 'Node']);
        assert.strictEqual(payload.limit, 5);
        assert.strictEqual(payload.location, 'United States');

        return {
          Payload: Buffer.from(
            JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'Success',
                totalFound: 1,
                jobs: [
                  {
                    id: '12345',
                    title: 'Full Stack Engineer',
                    companyName: 'Acme Corp',
                    location: 'Austin, TX',
                    jobUrl: 'https://www.linkedin.com/jobs/view/12345',
                    descriptionText: 'Building agentic web platforms with NestJS & Angular',
                  },
                ],
              }),
            }),
          ),
        };
      },
    };

    const jobs = await service.scrapeJobs({
      keywords: ['React', 'Node'],
      limit: 5,
      location: 'United States',
    });

    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].id, '12345');
    assert.strictEqual(jobs[0].title, 'Full Stack Engineer');
    assert.strictEqual(jobs[0].companyName, 'Acme Corp');
  });

  it('should support async mode without waiting for response payload', async () => {
    const service = new LambdaLinkedInScraperService();

    let dispatchedType = '';
    (service as any).lambdaClient = {
      send: async (command: any) => {
        dispatchedType = command.input.InvocationType;
        return {};
      },
    };

    const result = await service.scrapeJobs({
      keywords: ['Python'],
      asyncMode: true,
      webhookUrl: 'https://example.com/api/webhook',
    });

    assert.strictEqual(dispatchedType, 'Event');
    assert.deepStrictEqual(result, []);
  });
});

