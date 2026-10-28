import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ClaudeProposalService } from './claude-proposal.service';

test('preserves every explicitly supplied proof-story bullet when no AI provider is available', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousGoogle = process.env.GOOGLE_AI_KEY;
  const previousStudio = process.env.AI_STUDIO_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  delete process.env.AI_STUDIO_API_KEY;

  try {
    const service = new ClaudeProposalService();
    const result = await service.synthesizeProfileFromCv(`
Proof Stories:
- Google Project Kennedy — Led a cross-functional redesign adopted by 12 product teams.
- Meta Messenger — Increased user confidence in AI moderation by 42%.
- Cisco Commerce Workspace — Built patterns used by 15,000 users and $40B annual bookings.
- Pepper AI — Founded an assistant that reached 17,000 users.
- Spotlight Publishing — Reduced content production time by 80%.
- Acme Analytics — Delivered an enterprise reporting platform for 8 markets.
`);

    assert.equal(result.proofStories.length, 6);
    assert.deepEqual(
      result.proofStories.map((story) => story.companyOrProduct),
      [
        'Google Project Kennedy',
        'Meta Messenger',
        'Cisco Commerce Workspace',
        'Pepper AI',
        'Spotlight Publishing',
        'Acme Analytics',
      ],
    );
    assert.equal(
      result.proofStories[0].description,
      'Google Project Kennedy — Led a cross-functional redesign adopted by 12 product teams.',
    );
  } finally {
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    if (previousGoogle === undefined) delete process.env.GOOGLE_AI_KEY;
    else process.env.GOOGLE_AI_KEY = previousGoogle;
    if (previousStudio === undefined) delete process.env.AI_STUDIO_API_KEY;
    else process.env.AI_STUDIO_API_KEY = previousStudio;
  }
});

test('merges an explicit project bullet the AI omitted instead of persisting a truncated list', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({
            personaName: 'Test Consultant',
            offerHeadline: 'Outcome-focused delivery',
            proofStories: [
              { keyCode: 'META_MESSENGER', companyOrProduct: 'Meta Messenger', impactMetric: '+42%', domainTags: ['AI UX'] },
              { keyCode: 'CISCO', companyOrProduct: 'Cisco Commerce Workspace', impactMetric: '$40B', domainTags: ['Enterprise'] },
              { keyCode: 'PEPPER', companyOrProduct: 'Pepper AI', impactMetric: '17,000 users', domainTags: ['GenAI'] },
              { keyCode: 'SPOTLIGHT', companyOrProduct: 'Spotlight Publishing', impactMetric: '80% faster', domainTags: ['Automation'] },
              { keyCode: 'ACME', companyOrProduct: 'Acme Analytics', impactMetric: '8 markets', domainTags: ['Data'] },
            ],
          }) }],
        },
      }],
    }),
  })) as unknown as typeof fetch;

  try {
    const service = new ClaudeProposalService();
    const result = await service.synthesizeProfileFromCv(`
Proof Stories:
- Google Project Kennedy — Led a cross-functional redesign adopted by 12 product teams.
- Meta Messenger — Increased user confidence in AI moderation by 42%.
- Cisco Commerce Workspace — Built patterns used by 15,000 users and $40B annual bookings.
- Pepper AI — Founded an assistant that reached 17,000 users.
- Spotlight Publishing — Reduced content production time by 80%.
- Acme Analytics — Delivered an enterprise reporting platform for 8 markets.
`);

    assert.equal(result.proofStories.length, 6);
    assert.equal(result.proofStories[0].companyOrProduct, 'Google Project Kennedy');
    assert.equal(result.proofStories[0].description, 'Google Project Kennedy — Led a cross-functional redesign adopted by 12 product teams.');
  } finally {
    global.fetch = previousFetch;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
  }
});

test('keeps markdown voice rules out of proof stories and persists them as rules', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousGoogle = process.env.GOOGLE_AI_KEY;
  const previousStudio = process.env.AI_STUDIO_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  delete process.env.AI_STUDIO_API_KEY;

  try {
    const service = new ClaudeProposalService();
    const result = await service.synthesizeProfileFromCv(`
## Offer
AI-native UX for product teams: senior design-system, prototyping, and research delivered at agency speed.

## Target client
Seed-to-Series B SaaS founders who need senior UX work fast.

## Proof stories
- Meta Fintech: Standardized UX patterns across three teams, cutting design-related dev cycles 25%.
- Messenger: Ran AI-trust research that lifted user confidence 42% in A/B testing.
- Naehas: Built AI compliance tooling for Bank of America, First National Bank, and Pathward.
- Project Kennedy: Contributed to the design system that preceded Material Design.
- Cisco Commerce Workspace: Built the UI pattern library for 15,000+ users and $40B in annual bookings.
- Pepper AI: Founded a Gen AI entertainment assistant that reached 17,000+ users.

## Voice rules
- First person, peer-to-peer, like an operator talking to another operator.
- No em dashes anywhere.
- Lead with the result before naming the tool or technology.
- Use a relevant proof story instead of a generic skills list.
`);

    assert.equal(result.proofStories.length, 6);
    assert.deepEqual(result.voiceRules, [
      'First person, peer-to-peer, like an operator talking to another operator.',
      'No em dashes anywhere.',
      'Lead with the result before naming the tool or technology.',
      'Use a relevant proof story instead of a generic skills list.',
    ]);
    assert.equal(result.personaName, 'AI-Native UX Architect');
    assert.equal(result.offerHeadline, 'AI-native UX for product teams: senior design-system, prototyping, and research delivered at agency speed.');
    assert.equal(result.targetAudience, 'Seed-to-Series B SaaS founders who need senior UX work fast.');
    assert.deepEqual(result.taxonomy.coreRoles, ['Senior Product Designer', 'Design Systems Architect', 'UX Researcher', 'UX Strategist']);
  } finally {
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    if (previousGoogle === undefined) delete process.env.GOOGLE_AI_KEY;
    else process.env.GOOGLE_AI_KEY = previousGoogle;
    if (previousStudio === undefined) delete process.env.AI_STUDIO_API_KEY;
    else process.env.AI_STUDIO_API_KEY = previousStudio;
  }
});

test('uses the canonical AI-Native UX persona for structured positioning even when Gemini adds a subtitle', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        personaName: 'AI-Native UX Architect: Senior Design Systems & Research',
        offerHeadline: 'Generated offer',
        proofStories: [],
      }) }] } }],
    }),
  })) as unknown as typeof fetch;

  try {
    const service = new ClaudeProposalService();
    const result = await service.synthesizeProfileFromCv(`
## Offer
AI-native UX for product teams delivered at agency speed.

## Target client
Seed-to-Series B SaaS founders and product leads.
`);

    assert.equal(result.personaName, 'AI-Native UX Architect');
  } finally {
    global.fetch = previousFetch;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
  }
});

test('parseCvToPublicationsDocument returns structured bilingual PublicationsCvDocument', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              name: 'Leonardo Jaimes CV ATS',
              slug: 'ats-cv',
              description: 'ATS-friendly single-column layout version.',
              translations: {
                en: {
                  profile: { name: 'LEONARDO JAIMES', role: 'FULL STACK DEVELOPER', email: 'leo@test.com', phone: '+52 999' },
                  summary: { text: '10+ years experience in full-stack SaaS.' },
                  skills_technical: [{ category: 'Backend', items: ['NestJS', 'TypeScript'] }],
                  skills_soft: ['Leadership'],
                  experience: [{ title: 'Full Stack Dev', period: '2020 - Present', company: 'Spotlight', location: 'Merida' }],
                  education: [{ degree: 'B.S. Software', institution: 'University', location: 'MX', year: '2019' }],
                  languages: [{ name: 'Spanish', level: 'Native' }, { name: 'English', level: 'Fluent' }],
                },
                es: {
                  profile: { name: 'LEONARDO JAIMES', role: 'DESARROLLADOR FULL STACK', email: 'leo@test.com', phone: '+52 999' },
                  summary: { text: '10+ años de experiencia en SaaS full-stack.' },
                  skills_technical: [{ category: 'Backend', items: ['NestJS', 'TypeScript'] }],
                  skills_soft: ['Liderazgo'],
                  experience: [{ title: 'Desarrollador Full Stack', period: '2020 - Presente', company: 'Spotlight', location: 'Mérida' }],
                  education: [{ degree: 'Ing. Software', institution: 'Universidad', location: 'MX', year: '2019' }],
                  languages: [{ name: 'Español', level: 'Nativo' }, { name: 'Inglés', level: 'Fluido' }],
                },
              },
            }),
          }],
        },
      }],
    }),
  })) as unknown as typeof fetch;

  try {
    const service = new ClaudeProposalService();
    const result = await service.parseCvToPublicationsDocument('Raw CV Text of Leonardo', 'leo@test.com');
    assert.equal(result.slug, 'ats-cv');
    assert.equal(result.ownerEmail, 'leo@test.com');
    assert.equal(result.translations.en.profile.role, 'FULL STACK DEVELOPER');
    assert.equal(result.translations.es.profile.role, 'DESARROLLADOR FULL STACK');
  } finally {
    global.fetch = previousFetch;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
  }
});

test('parseCvToPublicationsDocument deterministically extracts all jobs, projects, education, and languages without AI', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousGoogle = process.env.GOOGLE_AI_KEY;
  const previousStudio = process.env.AI_STUDIO_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  delete process.env.AI_STUDIO_API_KEY;

  const rawCvText = `
LEONARDO JAIMES ESTEVEZ
FULL STACK DEVELOPER
leo777jaimes@gmail.com | +52 9999000935 | LinkedIn: linkedIn
SUMMARY
Full Stack Developer with 10+ years of experience building scalable web and mobile applications. Specialized in
Vue, Nuxt, Node.js, and MongoDB, with strong focus on AI-driven systems, automation, and spec-driven
development. Currently building a multi-tenant SaaS platform that automates content generation, decision-
making, and publishing based on real-time events and trends.
TECHNICAL SKILLS
AI & Automation: AI Agent Design, Prompt Engineering, Gemini, OpenAI, LangChain / Tavily, Spec-Driven Dev
(SDD), Workflow Orchestration
Backend Development: NestJS, Node.js, REST APIs, Multi-Tenant SaaS, Auth & RBAC, MongoDB, Firebase
Storage
Frontend Development: Vue, Nuxt, React, Next.js, TypeScript, Responsive Design
Tools & Delivery: Git, Docker, Agile/Scrum, Jira, TDD, Unit & Integration Testing
EXPERIENCE
Full Stack Developer \t01/2020 - Present
Spotlight Studio \tMérida, Yucatán, México
AI Publications Platform (SaaS)
Designed and led development of a multi-tenant SaaS platform that automates social media content creation
and publishing for multiple clients from a single system.
PepperTix Web Application
Led frontend development for PepperTix, a ticket resale web platform, utilizing Vue and Nuxt.js.
Pepper Tix Backend
Developed backend services to support PepperTix features using Node.js and Express.js.
Pepper Videos Mobile
Developed the Pepper Videos mobile application using Flutter.
Pepper Bot
Built a conversational event search chatbot for Facebook Messenger.
Independent Software Developer / Professional Transition \t2017 – 2019
Independent \tRemote
Focused on autonomous deep learning, updating technical stack to modern JavaScript frameworks (Vue.js, Node.js).
Application Development Assistant \t01/2013 - 12/2016
Fundación de la Mujer \tFloridablanca, Santander, Colombia
Assisted with operational issue resolution, debugging, and refactoring.
EDUCATION
Telecommunications Engineering \t2015
Unidades Tecnológicas de Santander \tBucaramanga, Colombia
Information Systems Analysis and Development \t2005
Servicio Nacional de Aprendizaje SENA \tSantander, Colombia
LANGUAGES
Spanish: Native English: B1+
`;

  try {
    const service = new ClaudeProposalService();
    const doc = await service.parseCvToPublicationsDocument(rawCvText, 'leo.jaimes.estevez@gmail.com');

    assert.equal(doc.slug, 'ats-cv');
    assert.equal(doc.translations.en.profile.name, 'LEONARDO JAIMES ESTEVEZ');
    assert.equal(doc.translations.en.profile.email, 'leo777jaimes@gmail.com');

    // Experience checks
    assert.equal(doc.translations.en.experience.length, 3, 'Should extract all 3 jobs');
    assert.equal(doc.translations.en.experience[0].company, 'Spotlight Studio');
    assert.equal(doc.translations.en.experience[0].projects?.length, 5, 'Spotlight Studio should have 5 projects');
    assert.equal(doc.translations.en.experience[0].projects?.[0].name, 'AI Publications Platform (SaaS)');
    assert.equal(doc.translations.en.experience[0].projects?.[4].name, 'Pepper Bot');
    assert.equal(doc.translations.en.experience[1].company, 'Independent');
    assert.equal(doc.translations.en.experience[2].company, 'Fundación de la Mujer');

    // Education checks
    assert.equal(doc.translations.en.education?.length, 2, 'Should extract 2 education entries');
    assert.equal(doc.translations.en.education?.[0].degree, 'Telecommunications Engineering');
    assert.equal(doc.translations.en.education?.[0].year, '2015');
    assert.equal(doc.translations.en.education?.[1].degree, 'Information Systems Analysis and Development');
    assert.equal(doc.translations.en.education?.[1].year, '2005');

    // Languages checks
    assert.equal(doc.translations.en.languages?.length, 2, 'Should extract 2 languages');
    assert.equal(doc.translations.en.languages?.[0].name, 'Spanish');
    assert.equal(doc.translations.en.languages?.[0].level, 'Native');
    assert.equal(doc.translations.en.languages?.[1].name, 'English');
    assert.equal(doc.translations.en.languages?.[1].level, 'B1+');

    // Spanish translation mirror checks
    assert.equal(doc.translations.es.experience.length, 3);
    assert.equal(doc.translations.es.experience[0].projects?.length, 5);
    assert.equal(doc.translations.es.experience[0].projects?.[0].name, 'Plataforma de Publicaciones AI (SaaS)');
    assert.equal(doc.translations.es.education?.[0].degree, 'Ingeniería en Telecomunicaciones');
    assert.equal(doc.translations.es.languages?.[0].name, 'Español');
    assert.equal(doc.translations.es.languages?.[0].level, 'Nativo');
  } finally {
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    if (previousGoogle === undefined) delete process.env.GOOGLE_AI_KEY;
    else process.env.GOOGLE_AI_KEY = previousGoogle;
    if (previousStudio === undefined) delete process.env.AI_STUDIO_API_KEY;
    else process.env.AI_STUDIO_API_KEY = previousStudio;
  }
});
