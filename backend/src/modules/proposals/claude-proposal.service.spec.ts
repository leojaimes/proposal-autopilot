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
  })) as typeof fetch;

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
  })) as typeof fetch;

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
