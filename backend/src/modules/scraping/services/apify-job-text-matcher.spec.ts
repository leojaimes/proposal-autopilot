import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesApifyJobText } from './apify-job-text-matcher';

test('matches an exact phrase in an Apify job title or description', () => {
  assert.equal(matchesApifyJobText({ title: 'Product Designer', description: 'Conduct UX research interviews.' }, 'UX research'), true);
  assert.equal(matchesApifyJobText({ title: 'Shopify Designer', description: 'Create a storefront.' }, 'UX research'), false);
});

test('matches any of the pipe-separated exact phrases', () => {
  assert.equal(matchesApifyJobText({ title: 'AEO specialist', description: 'Generative engine optimization strategy.' }, 'answer engine optimization|generative engine optimization'), true);
  assert.equal(matchesApifyJobText({ title: 'Geography tutor', description: 'Prepare students for exams.' }, 'answer engine optimization|generative engine optimization'), false);
});

test('requires every ampersand-separated phrase group', () => {
  const expression = 'ai|artificial intelligence&&developer|product designer';
  assert.equal(matchesApifyJobText({ title: 'AI Product Designer', description: 'Build prototypes.' }, expression), true);
  assert.equal(matchesApifyJobText({ title: 'AI Automation Specialist', description: 'Maintain workflows.' }, expression), false);
});

test('does not match an AI token inside an unrelated word', () => {
  assert.equal(matchesApifyJobText({ title: 'Maintenance developer', description: 'Support applications.' }, 'ai&&developer'), false);
});
