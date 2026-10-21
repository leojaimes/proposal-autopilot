import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DeterministicSemanticService, DynamicRoleTaxonomy } from './deterministic-semantic.service';

describe('DeterministicSemanticService (Zero-Regex Token Window Matcher)', () => {
  const service = new DeterministicSemanticService();

  const mockTaxonomy: DynamicRoleTaxonomy = {
    coreRoles: ['UI/UX design', 'UX research', 'design system', 'usability testing'],
    hybridRoles: ['AI product design', 'agentic workflow design', 'AI prototyping'],
    tangentialRoles: ['Product manager', 'Web designer', 'Graphic designer'],
    excludedRoles: ['Full Stack', 'Backend', 'React Developer', 'Software Engineer', 'Assistant', 'Telemarketing'],
  };

  it('debe dar Afinidad 1.0 a una vacante nuclear de UX Research', () => {
    const result = service.evaluateAffinity(
      'Senior UX Research Consultant for Customer Journey',
      'We need deep usability testing and heuristic evaluation in Figma.',
      ['UX Research', 'Figma', 'Usability Testing'],
      mockTaxonomy
    );

    assert.strictEqual(result.affinityMultiplier, 1.0);
    assert.strictEqual(result.matchedLane, 'CORE');
    assert.strictEqual(result.matchedTerm, 'ux research');
  });

  it('debe descalificar determinísticamente (Afinidad 0.15) un Full Stack Developer aunque mencione Agentic Workflows', () => {
    const result = service.evaluateAffinity(
      'Full Stack Developer: Agentic Workflows, APIs, React',
      'Build backend microservices and agentic workflow design in python.',
      ['React', 'Node.js', 'APIs'],
      mockTaxonomy
    );

    assert.strictEqual(result.affinityMultiplier, 0.15);
    assert.strictEqual(result.matchedLane, 'EXCLUDED');
    assert.strictEqual(result.matchedTerm, 'full stack');
  });

  it('debe tolerar variaciones de símbolos como UI/UX, UI-UX y UI UX', () => {
    const result1 = service.evaluateAffinity('Lead UI/UX Designer', '', [], mockTaxonomy);
    const result2 = service.evaluateAffinity('Lead UI-UX Designer', '', [], mockTaxonomy);
    const result3 = service.evaluateAffinity('Lead UI UX Designer', '', [], mockTaxonomy);

    assert.strictEqual(result1.matchedLane, 'CORE');
    assert.strictEqual(result2.matchedLane, 'CORE');
    assert.strictEqual(result3.matchedLane, 'CORE');
  });

  it('debe dar Afinidad >= 0.70 a un rol híbrido moderno (AI Product Design)', () => {
    const result = service.evaluateAffinity(
      'Senior AI Product Design Lead',
      'Create conversational flows and prototyping.',
      ['AI Prototyping'],
      mockTaxonomy
    );

    assert.strictEqual(result.matchedLane, 'HYBRID');
    assert.ok(result.affinityMultiplier >= 0.70, `Afinidad esperada >= 0.70, obtenida: ${result.affinityMultiplier}`);
  });

  it('debe dar Afinidad <= 0.50 a un rol tangencial (Product Manager)', () => {
    const result = service.evaluateAffinity(
      'Technical Product Manager',
      'Manage roadmaps and backlogs.',
      ['Jira', 'Roadmapping'],
      mockTaxonomy
    );

    assert.strictEqual(result.matchedLane, 'TANGENTIAL');
    assert.ok(result.affinityMultiplier <= 0.50, `Afinidad esperada <= 0.50, obtenida: ${result.affinityMultiplier}`);
  });
});
