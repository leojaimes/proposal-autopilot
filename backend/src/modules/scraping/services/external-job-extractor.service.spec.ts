import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ExternalJobExtractorService } from './external-job-extractor.service';

describe('ExternalJobExtractorService - Unit Test Suite', () => {
  it('should extract job details from raw vacancy text (title, company, description, skills)', async () => {
    const service = new ExternalJobExtractorService({} as any);

    const rawText = `
      Company: Litera
      Role: Senior Software Engineer
      Location: Denver, CO, United States
      
      About the job:
      We are looking for a Senior Software Engineer to build scalable cloud solutions.
      
      Requirements:
      - 5+ years of experience with TypeScript and Node.js
      - Deep expertise in Angular and Vue
      - Experience with PostgreSQL and Docker
    `;

    const result = await service.extractFromRawText(rawText);

    assert.ok(result, 'Result should be defined');
    assert.match(result.title, /Senior Software Engineer/i);
    assert.match(result.companyName, /Litera/i);
    assert.match(result.location, /Denver/i);
    assert.ok(result.requiredSkills.includes('TypeScript'), 'Should include TypeScript');
    assert.ok(result.requiredSkills.includes('Node.js'), 'Should include Node.js');
    assert.ok(result.requiredSkills.includes('Angular'), 'Should include Angular');
    assert.ok(result.requiredSkills.includes('PostgreSQL'), 'Should include PostgreSQL');
    assert.ok(result.description.includes('Senior Software Engineer'));
  });

  it('should detect and fetch Workday CXS JSON when given a Workday URL', async () => {
    const service = new ExternalJobExtractorService({} as any);
    const workdayUrl = 'https://litera.wd12.myworkdayjobs.com/Litera_Careers/job/Denver-CO/Senior-Software-Engineer_R-501348-1';

    const originalFetch = global.fetch;
    try {
      global.fetch = (async (url: any, _init?: any) => {
        if (String(url).includes('/wday/cxs/')) {
          return {
            ok: true,
            json: async () => ({
              jobPostingInfo: {
                title: 'Senior Software Engineer',
                location: 'Denver, CO',
                jobDescription: '<p>Join Litera to build legal tech with TypeScript, AWS, and PostgreSQL.</p>',
                postedOn: '2026-10-25',
              },
              hiringOrganization: 'Litera',
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      }) as any;

      const result = await (service as any).extractFromUrl(workdayUrl);

      assert.ok(result, 'Result should be defined');
      assert.strictEqual(result.title, 'Senior Software Engineer');
      assert.strictEqual(result.companyName, 'Litera');
      assert.match(result.location, /Denver/i);
      assert.ok(result.requiredSkills.includes('TypeScript'), 'Should detect TypeScript');
      assert.ok(result.requiredSkills.includes('AWS'), 'Should detect AWS');
      assert.ok(result.requiredSkills.includes('PostgreSQL'), 'Should detect PostgreSQL');
      assert.strictEqual(result.jobUrl, workdayUrl);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should delegate to Lambda scraper when given a protected LinkedIn job URL', async () => {
    const mockLambda = {
      scrapeJobs: async (options: any) => {
        return [
          {
            id: '998877',
            title: 'Lead Software Architect',
            companyName: 'Stripe',
            location: 'San Francisco, CA',
            jobUrl: options.jobUrl || 'https://www.linkedin.com/jobs/view/998877',
            descriptionText: 'Building financial infrastructure using TypeScript, Node.js and Microservices',
          },
        ];
      },
    };

    const serviceWithLambda = new ExternalJobExtractorService(mockLambda as any);
    const linkedinUrl = 'https://www.linkedin.com/jobs/view/998877';

    const result = await serviceWithLambda.extractFromUrl(linkedinUrl);

    assert.ok(result, 'Result should be defined');
    assert.strictEqual(result.title, 'Lead Software Architect');
    assert.strictEqual(result.companyName, 'Stripe');
    assert.match(result.location, /San Francisco/i);
    assert.ok(result.requiredSkills.includes('TypeScript'));
    assert.ok(result.requiredSkills.includes('Node.js'));
  });

  it('should detect company from various natural language patterns and avoid hardcoded fallback', async () => {
    const service = new ExternalJobExtractorService({} as any);

    // Case A: "About Stripe:"
    const textA = `
      Senior Backend Engineer
      About Stripe:
      Stripe is building economic infrastructure for the internet.
      Requirements: TypeScript, Node.js, PostgreSQL.
    `;
    const resA = await service.extractFromRawText(textA);
    assert.strictEqual(resA.companyName, 'Stripe');

    // Case B: "Role at Company"
    const textB = `
      Staff Cloud Architect at Spotify
      Location: Stockholm, Sweden
      Join our platform engineering team to build scalable microservices.
      Requirements: Go, Docker, Kubernetes.
    `;
    const resB = await service.extractFromRawText(textB);
    assert.strictEqual(resB.companyName, 'Spotify');

    // Case C: No company mentioned in text -> should NOT default to 'Litera'
    const textC = `
      Full Stack Developer
      We are looking for a developer to help build modern web applications.
      Requirements: React, Node.js.
    `;
    const resC = await service.extractFromRawText(textC);
    assert.notStrictEqual(resC.companyName, 'Litera', 'Should not default to Litera when not mentioned');
    assert.strictEqual(resC.companyName, 'Hiring Team');
  });
});
