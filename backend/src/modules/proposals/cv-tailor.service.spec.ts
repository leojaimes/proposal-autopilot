import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { CvTailorService, BaseCvData, CoverLetterData } from './cv-tailor.service';

describe('CvTailorService - TDD Suite (Publications Parity)', () => {
  const service = new CvTailorService();

  const mockCvData: BaseCvData = {
    profile: {
      name: 'LEONARDO JAIMES ESTEVEZ',
      role: 'FULL STACK DEVELOPER',
      email: 'leo777jaimes@gmail.com',
      phone: '+52 9999000935',
      linkedin_url: 'https://www.linkedin.com/in/leonardo-jaimes',
      linkedin_label: 'linkedIn',
    },
    summary: {
      text: 'Full Stack Developer with 10+ years of experience building scalable web applications and SaaS platforms.',
    },
    skills_technical: [
      {
        category: 'Backend Development',
        items: ['NestJS', 'Node.js', 'PostgreSQL', 'APIs REST'],
      },
      {
        category: 'AI & Modern Engineering',
        items: ['Claude Code', 'Gemini', 'Spec-Driven Dev'],
      },
    ],
    experience: [
      {
        title: 'Full Stack Developer',
        period: '01/2020 - Present',
        company: 'Spotlight Studio',
        location: 'Mérida, Yucatán, México',
        projects: [
          {
            name: 'Plataforma SaaS',
            description: 'Arquitectura y desarrollo con NestJS y Vue/React.',
          },
        ],
      },
    ],
  };

  const mockCoverLetter: CoverLetterData = {
    recipient: 'Engineering Leadership Team',
    subject: 'Application for Senior Full Stack Engineer position',
    salutation: 'Dear Hiring Team at Acme Corp,',
    valediction: 'Sincerely,',
    dateFormatted: '2026-10-27',
    paragraphs: [
      'I am writing to express my strong interest in the Full Stack Engineer role at Acme Corp.',
      'With over 10 years in full-stack engineering and deep daily practice in AI-assisted workflows, I deliver high-quality systems.',
      'Thank you for your consideration, and I look forward to speaking with you.',
    ],
  };

  it('✔ should build ATS CV HTML string with correct contact, summary and skills structure', () => {
    const html = service.buildCvHtml(mockCvData);

    assert.ok(html.includes('LEONARDO JAIMES ESTEVEZ'), 'Missing candidate name');
    assert.ok(html.includes('FULL STACK DEVELOPER'), 'Missing role title');
    assert.ok(html.includes('leo777jaimes@gmail.com'), 'Missing email');
    assert.ok(html.includes('Backend Development'), 'Missing technical category');
    assert.ok(html.includes('NestJS, Node.js'), 'Missing technical items');
    assert.ok(html.includes('Spotlight Studio'), 'Missing company experience');
  });

  it('✔ should build ATS Cover Letter HTML string with recipient, company, subject and paragraphs', () => {
    const html = service.buildCoverLetterHtml(mockCvData.profile, mockCoverLetter, 'Acme Corp');

    assert.ok(html.includes('LEONARDO JAIMES ESTEVEZ'), 'Missing candidate name in cover letter header');
    assert.ok(html.includes('Acme Corp'), 'Missing company display name');
    assert.ok(html.includes('Application for Senior Full Stack Engineer'), 'Missing subject line');
    assert.ok(html.includes('Dear Hiring Team at Acme Corp'), 'Missing salutation');
    assert.ok(html.includes('I am writing to express my strong interest'), 'Missing paragraph 1');
  });

  it('✔ should render vector PDF buffer via Gotenberg', async () => {
    const testHtml = service.buildCoverLetterHtml(mockCvData.profile, mockCoverLetter, 'Acme Corp');
    const pdfBuffer = await service.renderPdfViaGotenberg(testHtml);

    assert.ok(pdfBuffer instanceof Buffer, 'Expected Buffer output');
    assert.ok(pdfBuffer.length > 1000, `Expected PDF buffer > 1KB, got ${pdfBuffer.length}`);
    // Check PDF magic header %PDF-
    assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'Invalid PDF magic header');
  });

  it('✔ should adapt CV and generate cover letter with anti-slop rules', async () => {
    const result = await service.adaptCvAndCoverLetter({
      jobDescription: 'Looking for a Senior Full Stack Engineer with NestJS, TypeScript, React and AI workflows to build scalable SaaS.',
      companyName: 'Acme SaaS Corp',
      lang: 'en',
      baseCv: mockCvData,
    });

    assert.ok(result.adaptedCv, 'Missing adapted CV');
    assert.ok(result.coverLetter, 'Missing cover letter');
    assert.ok(result.coverLetter.paragraphs.length >= 2, 'Expected at least 2 paragraphs');
    assert.ok(result.detectedCompany.includes('Acme') || result.detectedCompany.length > 0, 'Company should be detected or assigned');
    assert.strictEqual(result.adaptedCv.profile.name, mockCvData.profile.name, 'Candidate name must be preserved');
  });
});

