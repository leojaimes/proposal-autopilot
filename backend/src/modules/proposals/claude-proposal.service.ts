import { Injectable, Logger } from '@nestjs/common';

export interface GenerateProposalInput {
  jobTitle: string;
  jobDescription: string;
  clientCountry?: string;
  proofStoryKey: string;
  proofStoryCompany?: string;
  proofStoryMetric?: string;
  offerHeadline?: string;
  targetAudience?: string;
  voiceRules?: string[];
  normalizedRole?: string;
}

export interface ProposalOutput {
  contactName: string;
  coverLetter35Words: string;
  technicalProposalBody: string;
  mermaidDiagramCode: string;
}

export interface SynthesizeQueriesInput {
  offerHeadline: string;
  targetAudience: string;
  proofStories: Array<{ companyOrProduct: string; impactMetric: string; domainTags: string[] }>;
  dealbreakerKeywords?: string[];
}

export interface SynthesizeQueriesOutput {
  searchQueries: string[];
  suggestedMinHourlyRate: number;
  suggestedMinBudgetFixed: number;
  rationale: string;
}

export interface SynthesizeTaxonomyInput {
  offerHeadline: string;
  targetAudience: string;
  proofStories: Array<{ companyOrProduct: string; impactMetric: string; domainTags: string[] }>;
}

export interface SynthesizeTaxonomyOutput {
  coreRoles: string[];
  hybridRoles: string[];
  tangentialRoles: string[];
  excludedRoles: string[];
  rationale: string;
}

export interface SynthesizeProfileFromCvOutput {
  personaName: string;
  offerHeadline: string;
  targetAudience: string;
  voiceRules: string[];
  proofStories: Array<{
    keyCode: string;
    companyOrProduct: string;
    impactMetric: string;
    description: string;
    domainTags: string[];
  }>;
  taxonomy: {
    coreRoles: string[];
    hybridRoles: string[];
    tangentialRoles: string[];
    excludedRoles: string[];
  };
  scrapingConfig: {
    searchKeywords: string[];
    minHourlyRate: number;
    minBudgetFixed: number;
    targetCountries: string[];
  };
  scoringRationale: {
    strengthsDetected: string[];
    scoringExplanation: string;
  };
}

@Injectable()
export class ClaudeProposalService {
  private readonly logger = new Logger(ClaudeProposalService.name);
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.AI_STUDIO_API_KEY;
  private readonly geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  constructor() {
    if (this.geminiApiKey) {
      this.logger.log(`🚀 Motor de Inteligencia activado con Google Gemini (${this.geminiModel})`);
    } else {
      this.logger.warn('Ni GEMINI_API_KEY ni ANTHROPIC_API_KEY configuradas. Generador operará en modo template.');
    }
  }

  /**
   * Keeps user-provided project bullets as source material. The model may enrich
   * their tags, but it must never decide that one of those explicit projects is
   * expendable because a prompt asks for a shorter shortlist.
   */
  private extractExplicitProofStories(rawText: string): SynthesizeProfileFromCvOutput['proofStories'] {
    const stories: SynthesizeProfileFromCvOutput['proofStories'] = [];
    const seen = new Set<string>();
    let inProofSection = false;

    for (const line of rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase();
      if (/^(?:#+\s*)?(?:proof\s*stories|case\s*stud(?:y|ies)|projects?|experience|achievements|success\s*stories|historias?\s+de\s+(?:autoridad|éxito)|casos?\s+de\s+éxito|proyectos?|experiencia|logros?)\s*:?$/.test(normalized)) {
        inProofSection = true;
        continue;
      }

      if (/^#+\s+\S/u.test(trimmed)) {
        inProofSection = false;
        continue;
      }

      if (/^(?:#+\s*)?[a-záéíóúñ][^:]{1,80}:$/.test(normalized)) {
        inProofSection = false;
        continue;
      }

      const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (!bullet || !inProofSection) continue;

      const description = bullet[1].replace(/\*\*/g, '').trim();
      if (!description) continue;
      const dedupeKey = description.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, ' ').trim();
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const companyOrProduct = this.extractProofStoryName(description);
      const keyBase = companyOrProduct.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 44) || 'USER_PROJECT';
      const keyCode = this.uniqueProofStoryKey(keyBase, stories);
      stories.push({
        keyCode,
        companyOrProduct,
        impactMetric: this.extractImpactMetric(description),
        description,
        domainTags: [],
      });
    }

    return stories;
  }

  private extractExplicitVoiceRules(rawText: string): string[] {
    const rules: string[] = [];
    const seen = new Set<string>();
    let inVoiceSection = false;

    for (const line of rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const normalized = trimmed.toLowerCase();

      if (/^(?:#+\s*)?(?:voice\s*rules?|writing\s*rules?|reglas?\s+de\s+voz)\s*:?$/.test(normalized)) {
        inVoiceSection = true;
        continue;
      }
      if (/^#+\s+\S/u.test(trimmed) || /^(?:#+\s*)?[a-záéíóúñ][^:]{1,80}:$/.test(normalized)) {
        inVoiceSection = false;
        continue;
      }

      const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (!bullet || !inVoiceSection) continue;
      const rule = bullet[1].replace(/\*\*/g, '').trim();
      const dedupeKey = rule.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, ' ').trim();
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rules.push(rule);
    }

    return rules;
  }

  private extractStructuredSection(rawText: string, headings: string[]): string | null {
    const lines = rawText.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      const inline = trimmed.match(/^(?:#+\s*)?([^:]+):\s*(.+)$/);
      const heading = trimmed.replace(/^#+\s*/u, '').trim().toLowerCase();
      const inlineHeading = inline?.[1].trim().toLowerCase();
      const matchesHeading = headings.includes(heading) || (inlineHeading != null && headings.includes(inlineHeading));
      if (!matchesHeading) continue;
      if (inline?.[2]) return inline[2].replace(/\*\*/g, '').trim();

      const content: string[] = [];
      for (let next = index + 1; next < lines.length; next += 1) {
        const candidate = lines[next].trim();
        if (/^#+\s+\S/u.test(candidate)) break;
        if (candidate) content.push(candidate.replace(/\*\*/g, ''));
      }
      return content.join(' ').trim() || null;
    }
    return null;
  }

  private extractProofStoryName(description: string): string {
    const firstClause = description.split(/\s(?:—|–|\||:|-)\s/)[0]?.trim();
    if (firstClause && firstClause.length <= 100) return firstClause;
    const beforeAction = description.split(/\b(?:built|led|designed|developed|launched|scaled|created|delivered|implemented|dirigí|lideré|diseñé|desarrollé|lancé|escalé|creé|implementé)\b/i)[0]?.trim();
    return (beforeAction || description).slice(0, 100);
  }

  private extractImpactMetric(description: string): string {
    const metric = description.match(/(?:\$[\d,.]+(?:\s?[KMB])?|\b[\d,.]+%|\b[\d,.]+\+?\s+(?:users?|clients?|projects?|teams?|days?|hours?|months?|years?))[^.;]*/i);
    return metric?.[0]?.trim() || description;
  }

  private uniqueProofStoryKey(base: string, stories: SynthesizeProfileFromCvOutput['proofStories']): string {
    let key = base;
    let suffix = 2;
    while (stories.some((story) => story.keyCode === key)) {
      key = `${base.slice(0, 44)}_${suffix++}`;
    }
    return key;
  }

  private mergeExplicitProofStories(
    explicitStories: SynthesizeProfileFromCvOutput['proofStories'],
    generatedStories: SynthesizeProfileFromCvOutput['proofStories'],
  ): SynthesizeProfileFromCvOutput['proofStories'] {
    if (explicitStories.length === 0) return generatedStories;

    const unmatchedGenerated = [...generatedStories];
    const preserved = explicitStories.map((explicit) => {
      const explicitName = explicit.companyOrProduct.toLowerCase();
      const matchIndex = unmatchedGenerated.findIndex((generated) => {
        const generatedName = generated.companyOrProduct.toLowerCase();
        return generatedName === explicitName
          || generatedName.includes(explicitName)
          || explicitName.includes(generatedName);
      });
      const generated = matchIndex >= 0 ? unmatchedGenerated.splice(matchIndex, 1)[0] : undefined;
      return {
        ...explicit,
        impactMetric: generated?.impactMetric || explicit.impactMetric,
        domainTags: generated?.domainTags?.length ? generated.domainTags : explicit.domainTags,
      };
    });

    return preserved;
  }

  /**
   * Genera la propuesta con la regla estricta: ~35 palabras, hook de autoridad con ProofStory, y diagrama Mermaid.
   * Aplica Humanizer: 0 guiones largos (—), 0 clichés de IA, tono senior Slack direct-to-point.
   */
  async generate(input: GenerateProposalInput): Promise<ProposalOutput> {
    // 1. Prioridad: Gemini 3.8 Flash
    if (this.geminiApiKey && !this.geminiApiKey.includes('REPLACE_WITH_YOUR')) {
      try {
        return await this.generateWithGemini(input);
      } catch (error) {
        this.logger.error('Error invocando Gemini API. Activando fallback seguro a template:', error);
      }
    }

    // 2. Fallback Template calibrado si no hay API o si falló
    const company = input.proofStoryCompany || input.proofStoryKey;
    const metric = input.proofStoryMetric || '17,000+ users and high availability';
    return {
      contactName: '',
      coverLetter35Words: `Hey there, I work with product architecture daily. Having scaled ${company} (${metric}), I mapped the exact technical breakdown for your project. Free walkthrough here: [link].`,
      technicalProposalBody: `# Roadmap & Strategic Proposal for ${input.jobTitle}\n\n## 1. Executive Summary & Problem Diagnosis\nStrategic diagnosis and execution roadmap tailored for ${input.jobTitle}. Focusing on direct transformation, architecture clarity, and rapid execution.\n\n## 2. Technical Architecture & Recommended Approach\nModular system design, token-based architecture, and developer-ready specifications.\n\n## 3. Agile 2-to-3 Week Execution Milestones\n- Phase 1 (Week 1): Requirements Audit & Interactive Figma Prototype (Day 5)\n- Phase 2 (Week 2): Design System & Responsive Core UI\n- Phase 3 (Week 3): Usability Testing, Automation & Production Handover\n\n## 4. Deliverables & Acceptance Criteria\nComplete production source files, responsive components, documentation, and handover walk-through.`,
      mermaidDiagramCode: `flowchart TD\n  A[Requirements Audit] --> B[Architecture Blueprint]\n  B --> C[Interactive Prototype]\n  C --> D[QA & Validation]\n  D --> E[Production Delivery]`
    };
  }

  private async generateWithGemini(input: GenerateProposalInput): Promise<ProposalOutput> {
    const prompt = `You are a world-class fractional technical operator, senior product specialist, and elite Upwork proposal strategist.
Analyze the following client job post and synthesize a hyper-personalized, high-converting proposal by crossing THREE strict inputs:
1. CLIENT VACANCY (Real client need, pain points, technical context)
2. AUTHORITY PROOF STORY (Real metric and audited accomplishment)
3. SPECIFIC OFFER / TRANSFORMATION (Value proposition and role promise)

[1. CLIENT VACANCY]
Job Title: ${input.jobTitle}
Description: ${input.jobDescription}
Client Country: ${input.clientCountry || 'International'}

[2. AUTHORITY PROOF STORY]
Key: ${input.proofStoryKey}
Project / Company: ${input.proofStoryCompany || input.proofStoryKey}
Audited Metric: ${input.proofStoryMetric || 'Scaled production platform with proven uptime'}

[3. SPECIFIC OFFER / TRANSFORMATION]
Role: ${input.normalizedRole || 'Senior Product Specialist'}
Offer Headline: ${input.offerHeadline || 'AI-native UX & High-Scale Product Architecture'}
Target Audience: ${input.targetAudience || 'Seed-to-Series B SaaS founders and product leads'}
Voice Guidelines: ${Array.isArray(input.voiceRules) ? input.voiceRules.join(', ') : (input.voiceRules || 'First person peer-to-peer, zero filler, no em dashes')}

[CRITICAL PSYCHOLOGICAL INBOX DYNAMICS - THE 2-LINE SCREEN TRAP]
- The client skims 30 to 50 proposals in their Upwork inbox. They only read the first 2 lines (~150 characters) before deciding whether to archive or click.
- IF YOUR FIRST SENTENCE IS A STATIC DISCONNECTED FACT IN A VACUUM (e.g. "Contributed to Google Project Kennedy design system" for a non-UI job), THE CLIENT ASSUMES IT IS GENERIC BOT SPAM AND ARCHIVES IMMEDIATELY.
- THEREFORE, YOU MUST CONSTRUCT A "TRANSFERABLE AUTHORITY BRIDGE":
  The very first sentence MUST bridge your proof story metric directly into the client's primary deliverable.
  Extract the transferable core (e.g., automation, user scale, conversion, latency reduction, high-volume workflows) and connect it immediately into an active compound statement.
  Winning sentence-1 patterns:
  * "Having [scaled/built/automated X metric at ProofStoryCompany], I will [solve client deliverable/bottleneck]..."
  * "At [ProofStoryCompany], I [achieved X metric], and I will apply that same system to [solve client bottleneck]..."

[STRICT HUMANIZER REQUIREMENTS - ZERO AI WRITING TELLS]
- LANGUAGE: Natural, fluent US English.
- ACCESSIBILITY & PLAIN ENGLISH: Written in clean, everyday language that ANY client (whether a non-technical founder, CEO, or tech lead) can immediately understand and approve.
- AVOID PSEUDO-INTELLECTUAL JARGON: Translate complex engineering/design jargon into clear, tangible actions:
  * Say "testing screens with real users to see where they get confused" instead of "conducting qualitative heuristic evaluation benchmarks".
  * Say "clean Figma components so developers can build faster" instead of "architecting atomic tokenized design primitives".
  * Keep sentences active, direct, and under 25 words.
- NO em dashes (—) anywhere. Zero. Use commas, periods, or standard hyphens (-).
- NO conversational filler: Never say "I hope this finds you well", "I am thrilled to apply", "I would love to help", "Look no further", "Are you looking for...".
- NO stock AI buzzwords: Do NOT use "delve", "testament", "tapestry", "seamless", "cutting-edge", "game-changer", "elevate", "pivotal", "beacon", "in today's fast-paced world".
- NO "Not X but Y" artificial contrasts ("It's not just a design, it's an experience").
- NO dramatic one-line closers ("That is the real win.", "Let that sink in.").
- TONE: Direct, clear, peer-to-peer practitioner. Sounds like a sharp Silicon Valley product engineer communicating plainly on Slack.

[OUTPUT REQUIREMENTS - VALID JSON ONLY]
Return a strictly valid JSON object without markdown formatting wrappers or conversational commentary:
{
  "contactName": "string",
  "coverLetter35Words": "string",
  "technicalProposalBody": "string",
  "mermaidDiagramCode": "string"
}

[STRICT GUIDELINES FOR EACH FIELD]
1. "contactName":
   - Scan the full job description for a name, signature, or company mention (e.g. "thanks, Sara", "Best, John", "I'm Mike from Acme").
   - If found, return that specific first name (e.g. "Sara").
   - If NOT found, return "there" (so the letter opens naturally as "Hey there,"). NEVER return "Sir/Madam", "Hiring Manager", or "Hiring Team".

2. "coverLetter35Words":
   - STRICT CONSTRAINT: Word count MUST be between 30 and 35 words total (including the [link] token).
   - Greeting:
     * If contact name found: "Hey [Name]," or "Hi [Name],".
     * If not found: "Hey there," or "Hi,". NEVER use formal greetings.
   - Core shape:
     "Hey [Name], I work with [specific tool/technology from job] daily. Having [audited proof metric at Company], I just mapped the technical architecture for your project. Free walkthrough and roadmap here: [link]."
   - Punchy, confident, peer-to-peer practitioner. 0 em-dashes (—).

3. "technicalProposalBody":
   - First-person ("I"), customized specifically to this project:
     # Technical Proposal & Execution Roadmap: ${input.jobTitle}
     ## 1. Executive Summary & Diagnostic Hook
     A one-line hook demonstrating that I already spent time thinking deeply about this specific project, followed by a short intro pulling from my positioning and proof story (${input.proofStoryCompany || 'Pepper AI'}: ${input.proofStoryMetric || '17,000+ active users'}).
      
      ## 2. 5-Step Technical Approach & Methodology
     Provide a 5 to 6 step technical breakdown with brief reasoning for each step, explicitly naming real industry tools and methods matching the role's domain:
     - For UI/UX & Product Design: Step 1 (Claude & Qualtrics research synthesis), Step 2 (Information Architecture & workflow mapping), Step 3 (Figma & Figma Make rapid AI-assisted prototyping & design tokens), Step 4 (n8n agentic workflow automation), Step 5 (Usability testing & heuristic validation).
     - For Engineering / DevOps / Mobile / Other Domains: Adapt the 5 steps to real industry tools for that domain (e.g. Terraform, Kubernetes, GitHub Actions for DevOps; React, NestJS, Postgres, Playwright for Fullstack; Flutter, Swift, Firebase for Mobile).
     
     ## 3. Deliverables & Realistic Timeline (Agile 2 to 3-Week Sprint)
     Structure the delivery as a high-velocity 2 to 3-week sprint (10 to 15 business days). Avoid slow 2-month timelines; clients on Upwork want senior speed and rapid momentum.
     - Phase 1 (Week 1, Days 1-5): Discovery, Architecture & Core Prototype. Promise an interactive click-through or working prototype ready by Day 5.
     - Phase 2 (Week 2, Days 6-10): Core System Implementation. Scalable components, robust modules, and production-grade flows.
     - Phase 3 (Week 3, Days 11-15): Hardening, Testing & Clean Handoff. User/automated testing, complete documentation, and seamless handoff.
    - STRICT NEGATIVE CONSTRAINT: NEVER write ASCII diagrams, box drawings, or text pipelines inside "technicalProposalBody".

4. "mermaidDiagramCode":
   - A Mermaid flowchart (flowchart TD), 6 NODES MAXIMUM, matching the 5-6 technical breakdown steps.
   - Example format:
flowchart TD
  A[Discovery & Claude Research] --> B[Information Architecture]
  B --> C[Figma AI-Assisted Prototype]
  C --> D[n8n Workflow Automation]
  D --> E[Usability Testing & Handover]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    // Sanitize Humanizer rules: Strip em dashes, stock AI tells, and format cleanly
    const letter = this.applyHumanizerSanitizer(parsed.coverLetter35Words || '');
    const proposal = this.applyHumanizerSanitizer(parsed.technicalProposalBody || '');

    let mermaid = (parsed.mermaidDiagramCode || 'flowchart TD\n  A[Discovery & Audit] --> B[Architecture & Prototype] --> C[QA & Delivery]')
      .replace(/^```(mermaid)?/im, '')
      .replace(/```$/im, '')
      .trim();

    return {
      contactName: parsed.contactName && parsed.contactName !== 'there' ? parsed.contactName : '',
      coverLetter35Words: letter,
      technicalProposalBody: proposal,
      mermaidDiagramCode: mermaid,
    };
  }

  /**
   * Sanitizador Humanizer: Elimina patrones de IA, guiones largos y clichés
   */
  private applyHumanizerSanitizer(text: string): string {
    if (!text) return '';
    return text
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      .replace(/\bdelve\s+into\b/gi, 'examine')
      .replace(/\bdelve\b/gi, 'explore')
      .replace(/\bseamlessly\b/gi, 'smoothly')
      .replace(/\bseamless\b/gi, 'smooth')
      .replace(/\bcutting-edge\b/gi, 'modern')
      .replace(/\bgame-changer\b/gi, 'major improvement')
      .replace(/\belevate\b/gi, 'improve')
      .replace(/\btapestry\b/gi, 'structure')
      .replace(/\btestament\s+to\b/gi, 'evidence of')
      .replace(/\bpivotal\b/gi, 'important')
      .replace(/\bin\s+today's\s+(?:fast-paced|digital)\s+world\b/gi, 'today')
      .replace(/\bI\s+hope\s+this\s+(?:email|message|proposal)\s+finds\s+you\s+well[.,!]?\s*/gi, '')
      .replace(/\bDear\s+(?:Sir\/Madam|Hiring\s+Manager|Client)[.,:]?\s*/gi, 'Hey, ')
      .trim();
  }

  /**
   * Sintetiza queries booleanas optimizadas para Upwork a partir del perfil y las Proof Stories.
   */
  async synthesizeQueries(input: SynthesizeQueriesInput): Promise<SynthesizeQueriesOutput> {
    const dealbreakers = (input.dealbreakerKeywords && input.dealbreakerKeywords.length > 0)
      ? input.dealbreakerKeywords
      : ['crypto', 'tutor', 'unpaid', 'commission only', 'internship'];

    if (this.geminiApiKey && !this.geminiApiKey.includes('REPLACE_WITH_YOUR')) {
      try {
        const prompt = `You are an elite Upwork Lead Generation Strategist for specialized high-ticket consultants and product agencies.
Analyze the following contractor positioning profile, transformation offer, and authority proof stories.
Synthesize exactly 3 to 5 high-intent, targeted search queries strictly formatted for Upwork's native search engine (Lucene/Elasticsearch boolean syntax).

[TRANSFORMATION OFFER]
Headline: ${input.offerHeadline}
Target Audience: ${input.targetAudience}

[AUTHORITY PROOF STORIES]
${input.proofStories.map((s, i) => `#${i + 1} Company/Product: ${s.companyOrProduct} | Impact Metric: ${s.impactMetric} | Domain Tags: ${s.domainTags.join(', ')}`).join('\n')}

[DEALBREAKERS / EXCLUSIONS]
${dealbreakers.join(', ')}

[OUTPUT REQUIREMENTS]
1. Target the specific PAIN POINTS, ARCHITECTURAL BOTTLENECKS, and TRANSFORMATIONS solved by these proof stories.
2. Use valid Upwork boolean operators (AND, OR, NOT) and double quotes for exact multi-word phrases (e.g. ("Design System" OR "Figma Variables") AND ("SaaS" OR "Enterprise")).
3. Exclude low-ticket noise using NOT (e.g. NOT ("Crypto" OR "Tutor" OR "Unpaid")).
4. Output STRICT JSON:
{
  "searchQueries": [
    "(\\"Query 1\\" OR \\"...\\") AND (\\"...\\")",
    "(\\"Query 2\\" OR \\"...\\") AND (\\"...\\")",
    "(\\"Query 3\\" OR \\"...\\") NOT (\\"...\\")"
  ],
  "suggestedMinHourlyRate": 45,
  "suggestedMinBudgetFixed": 1000,
  "rationale": "Why these queries target clients needing this exact transformation"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.searchQueries) && parsed.searchQueries.length > 0) {
            return {
              searchQueries: parsed.searchQueries,
              suggestedMinHourlyRate: Number(parsed.suggestedMinHourlyRate) || 40,
              suggestedMinBudgetFixed: Number(parsed.suggestedMinBudgetFixed) || 1000,
              rationale: parsed.rationale || 'Consultas booleanas generadas dinámicamente con IA.',
            };
          }
        }
      } catch (err) {
        this.logger.error('Error sintetizando queries con Gemini, usando fallback determinista:', err);
      }
    }

    // Fallback Determinista Inteligente
    const notClause = `NOT (${dealbreakers.slice(0, 4).map(d => `"${d}"`).join(' OR ')})`;
    const fallbackQueries: string[] = [];

    // Query 1: Basada en la historia #1
    if (input.proofStories.length > 0) {
      const s1 = input.proofStories[0];
      const tags = s1.domainTags.slice(0, 3).map(t => `"${t}"`).join(' OR ');
      fallbackQueries.push(`(${tags || '"Design System"'}) AND ("SaaS" OR "Enterprise") ${notClause}`);
    }

    // Query 2: Basada en la historia #2 o AI UX
    if (input.proofStories.length > 1) {
      const s2 = input.proofStories[1];
      const tags = s2.domainTags.slice(0, 3).map(t => `"${t}"`).join(' OR ');
      fallbackQueries.push(`(${tags || '"AI UX"'}) AND ("Product" OR "Prototype") ${notClause}`);
    } else {
      fallbackQueries.push(`("AI Interaction" OR "Agentic UX" OR "Conversational AI") ${notClause}`);
    }

    // Query 3: Rediseño / Transformación
    fallbackQueries.push(`("B2B SaaS" OR "Product Designer") AND ("Redesign" OR "Design Tokens") ${notClause}`);

    return {
      searchQueries: fallbackQueries,
      suggestedMinHourlyRate: 40,
      suggestedMinBudgetFixed: 1000,
      rationale: 'Consultas combinatorias derivadas directamente de los tags de tus historias de autoridad.',
    };
  }

  /**
   * Sintetiza la taxonomía dinámica de 4 niveles (Core, Hybrid, Tangential, Excluded) usando IA
   * basándose en la oferta de posicionamiento y las Proof Stories.
   */
  async synthesizeTaxonomy(input: SynthesizeTaxonomyInput): Promise<SynthesizeTaxonomyOutput> {
    const fallback: SynthesizeTaxonomyOutput = {
      coreRoles: ['UI/UX design', 'UX research', 'design system', 'usability testing'],
      hybridRoles: ['AI product design', 'agentic workflow design', 'AI prototyping'],
      tangentialRoles: ['Product manager', 'Web designer', 'Graphic designer'],
      excludedRoles: ['Full Stack', 'Backend', 'React Developer', 'Software Engineer', 'Assistant', 'Telemarketing'],
      rationale: 'Taxonomía estándar de protección deductiva para Senior UI/UX.',
    };

    if (this.geminiApiKey && !this.geminiApiKey.includes('REPLACE_WITH_YOUR')) {
      try {
        const prompt = `You are an elite Recruitment & Strategic Positioning Architect for Upwork.
Analyze this contractor positioning profile and generate a 4-tier Role Affinity Taxonomy for job classification.

[CONTRACTOR PROFILE]
Headline: ${input.offerHeadline}
Target Audience: ${input.targetAudience}
Proof Stories: ${input.proofStories.map(ps => `${ps.companyOrProduct} (${ps.impactMetric})`).join(', ')}

Categorize job market roles into exactly 4 distinct tiers:
1. coreRoles (1.0 - 100% Fit): The absolute direct execution domain (e.g. UX research, UI/UX design, Figma, Usability testing). 4 to 6 items.
2. hybridRoles (0.8 - 80% Fit): High-ticket, modern cross-disciplinary roles matching the positioning (e.g. AI product design, agentic workflow design, AI prototyping). 3 to 5 items.
3. tangentialRoles (0.4 - 40% Fit): Adjacent or partial product roles that might contain relevant work (e.g. Product manager, Web designer). 3 to 4 items.
4. excludedRoles (0.0 - Incompatible): Roles that often appear in searches due to shared buzzwords (like 'workflows', 'AI', 'automation', 'React') but represent software engineering, coding, or irrelevant work (e.g. Full Stack, Backend, React Developer, Software Engineer, DevOps, Assistant, Telemarketing). 6 to 10 items.

Output STRICT JSON:
{
  "coreRoles": ["..."],
  "hybridRoles": ["..."],
  "tangentialRoles": ["..."],
  "excludedRoles": ["..."],
  "rationale": "Why these boundaries protect this contractor from engineering noise"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = JSON.parse(raw);

          return {
            coreRoles: Array.isArray(parsed.coreRoles) ? parsed.coreRoles : fallback.coreRoles,
            hybridRoles: Array.isArray(parsed.hybridRoles) ? parsed.hybridRoles : fallback.hybridRoles,
            tangentialRoles: Array.isArray(parsed.tangentialRoles) ? parsed.tangentialRoles : fallback.tangentialRoles,
            excludedRoles: Array.isArray(parsed.excludedRoles) ? parsed.excludedRoles : fallback.excludedRoles,
            rationale: parsed.rationale || 'Taxonomía sintetizada con Gemini Flash.',
          };
        }
      } catch (err: any) {
        this.logger.error(`Error sintetizando taxonomía con Gemini: ${err.message}. Usando fallback.`);
      }
    }

    return fallback;
  }

  /**
   * Sintetiza un Perfil de Posicionamiento completo (Oferta, Audiencia, Proof Stories,
   * Taxonomía de 4 capas, Queries Upwork y Explicación de Scoring) a partir del texto
   * de un CV, perfil de LinkedIn o notas de experiencia del usuario.
   */
  async synthesizeProfileFromCv(rawText: string): Promise<SynthesizeProfileFromCvOutput> {
    const trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new Error('El texto del CV o resumen de experiencia no puede estar vacío.');
    }

    const explicitProofStories = this.extractExplicitProofStories(trimmed);
    const explicitVoiceRules = this.extractExplicitVoiceRules(trimmed);
    const explicitOffer = this.extractStructuredSection(trimmed, ['offer', 'specific offer']);
    const explicitTargetAudience = this.extractStructuredSection(trimmed, ['target client', 'target audience', 'who you are targeting']);
    const isAiNativeUxPositioning = /\b(?:ai-native|ux|design system|ux research|prototyping)\b/i.test(
      [explicitOffer, explicitTargetAudience, ...explicitProofStories.map((story) => story.description)].filter(Boolean).join(' '),
    );
    const hasStructuredAiNativeUxPositioning = Boolean(
      isAiNativeUxPositioning && explicitOffer && explicitTargetAudience,
    );
    const fallback: SynthesizeProfileFromCvOutput = {
      personaName: isAiNativeUxPositioning ? 'AI-Native UX Architect' : 'Consultor Especialista',
      offerHeadline: explicitOffer || (isAiNativeUxPositioning
        ? 'AI-native UX for product teams: senior design systems, prototyping, and research delivered at agency speed.'
        : 'High-Impact Engineering & Architecture for scaling tech products and startups.'),
      targetAudience: explicitTargetAudience || (isAiNativeUxPositioning
        ? 'Seed-to-Series B SaaS founders and product leads needing senior UX delivery without a full-time hire.'
        : 'Founders, CTOs, and technical leaders needing senior architecture and fast execution.'),
      voiceRules: ['First person peer-to-peer', 'No em dashes anywhere', 'Sell result before tool'],
      proofStories: [
        {
          keyCode: 'FLAGSHIP_PROJECT',
          companyOrProduct: 'Plataforma Principal',
          impactMetric: '+40% de eficiencia y escalabilidad demostrada',
          description: 'Plataforma Principal: +40% de eficiencia y escalabilidad demostrada',
          domainTags: ['Architecture', 'SaaS', 'Full Stack'],
        },
      ],
      taxonomy: {
        coreRoles: isAiNativeUxPositioning
          ? ['Senior Product Designer', 'Design Systems Architect', 'UX Researcher', 'UX Strategist']
          : ['Software Engineer', 'Full Stack Developer', 'Architect'],
        hybridRoles: isAiNativeUxPositioning
          ? ['AI Product Designer', 'AI Prototyping Specialist', 'Design Operations Consultant']
          : ['Automation Engineer', 'AI Prototyper'],
        tangentialRoles: isAiNativeUxPositioning
          ? ['Product Manager', 'Frontend Design Consultant']
          : ['Technical Consultant'],
        excludedRoles: isAiNativeUxPositioning
          ? ['Graphic Designer', 'Data Entry', 'Telemarketing', 'Virtual Assistant', 'Backend Developer']
          : ['Virtual Assistant', 'Data Entry', 'Telemarketing', 'Customer Support'],
      },
      scrapingConfig: {
        searchKeywords: isAiNativeUxPositioning
          ? ['("Design System" OR "UX Research" OR "Product Design") AND ("SaaS" OR "AI")']
          : ['("Full Stack" OR "Engineer") AND ("SaaS" OR "Cloud")'],
        minHourlyRate: isAiNativeUxPositioning ? 100 : 45,
        minBudgetFixed: isAiNativeUxPositioning ? 3000 : 1000,
        targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'],
      },
      scoringRationale: {
        strengthsDetected: isAiNativeUxPositioning
          ? ['Design systems senior', 'UX research', 'AI-assisted product delivery']
          : ['Ingeniería de software', 'Arquitectura'],
        scoringExplanation: isAiNativeUxPositioning
          ? 'Se priorizan vacantes de sistemas de diseño, investigación UX y producto SaaS con señal explícita de IA.'
          : 'Se priorizan vacantes con alta demanda técnica y clientes con método de pago verificado.',
      },
    };

    if (this.geminiApiKey && !this.geminiApiKey.includes('REPLACE_WITH_YOUR')) {
      try {
        const prompt = `You are an elite Positioning & Lead Generation Architect for top 1% independent consultants on Upwork.
Analyze the following CV / LinkedIn summary / raw experience text.
Extract their true technical strengths, projects, achievements, and market positioning.
Synthesize a fully calibrated contractor profile for our multi-tier scoring engine.

[RAW CV / EXPERIENCE TEXT]
${trimmed.substring(0, 10000)}

[STRATEGIC INSTRUCTIONS]
1. personaName: Formal name followed by their core positioning title (e.g. "Leonardo Jaimes: Senior Full Stack & AI Architect").
2. offerHeadline: A punchy, value-first transformation statement (max 200 chars). Sell the business outcome, not just a list of tools.
3. targetAudience: Specific Ideal Customer Profile (ICP) with high buying power (e.g. "Founders, CTOs, and technical leaders of fast-growing SaaS startups...").
4. proofStories: Extract REAL projects/companies mentioned in the text.
   - If the user provides an explicit bullet/numbered project list, return EVERY distinct listed project exactly once. Never cap, omit, merge, or replace an explicitly supplied project; preserve the original project/company name.
   - Only when no explicit project list exists, select 3 to 5 representative real projects/companies.
   - keyCode: SNAKE_CASE uppercase identifier (e.g. SPOTLIGHT_AI, PEPPERTIX).
   - companyOrProduct: Name of the company or product.
   - impactMetric: Tangible, quantified impact metric (e.g. "80% Reduction in Content Production Time", "$40B Annual Bookings", "17,000+ Users").
   - domainTags: 3 to 5 skill/technology tags.
5. taxonomy (The 4-tier semantic role boundaries):
   - coreRoles (1.0 - 100% Fit): The 5 to 7 exact primary roles where the candidate is a top-tier expert (e.g. "Full Stack Developer", "Backend Engineer", "NestJS Developer").
   - hybridRoles (0.8 - 80% Fit): 4 to 6 modern cross-disciplinary roles combining their skills (e.g. "AI Agent Architect", "Automation Engineer").
   - tangentialRoles (0.4 - 40% Fit): 2 to 4 border roles that touch product or tech.
   - excludedRoles (0.0 - Immediate Disqualifiers): 5 to 8 incompatible roles or low-ticket noise that would waste connects (e.g. UI/UX design if they are a pure backend dev, or telemarketing, virtual assistant, data entry, manual QA).
6. scrapingConfig:
   - searchKeywords: 4 to 5 high-intent Upwork boolean search queries using Lucene syntax (e.g. '("Full Stack" OR "Fullstack") AND ("NestJS" OR "Vue")').
   - minHourlyRate: Recommended minimum hourly rate ($USD) matching their seniority.
   - minBudgetFixed: Recommended minimum fixed budget ($USD).
   - targetCountries: Top paying countries (United States, United Kingdom, Canada, Australia, Germany, Ireland).
7. scoringRationale:
   - strengthsDetected: Array of 3 to 6 key strengths and advantages detected in the candidate.
   - scoringExplanation: Clear, concise explanation (in Spanish) of how the scoring will evaluate jobs: which technical matches earn 100% score and which roles/factors trigger an immediate disqualification.

Output STRICT JSON:
{
  "personaName": "...",
  "offerHeadline": "...",
  "targetAudience": "...",
  "voiceRules": ["First person peer-to-peer", "No em dashes anywhere", "Sell result before tool"],
  "proofStories": [
    {
      "keyCode": "...",
      "companyOrProduct": "...",
      "impactMetric": "...",
      "domainTags": ["..."]
    }
  ],
  "taxonomy": {
    "coreRoles": ["..."],
    "hybridRoles": ["..."],
    "tangentialRoles": ["..."],
    "excludedRoles": ["..."]
  },
  "scrapingConfig": {
    "searchKeywords": ["..."],
    "minHourlyRate": 50,
    "minBudgetFixed": 1000,
    "targetCountries": ["United States", "United Kingdom", "Canada", "Australia", "Germany"]
  },
  "scoringRationale": {
    "strengthsDetected": ["..."],
    "scoringExplanation": "..."
  }
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = JSON.parse(raw);

          if (parsed.personaName && parsed.offerHeadline && Array.isArray(parsed.proofStories)) {
            return {
              personaName: hasStructuredAiNativeUxPositioning ? 'AI-Native UX Architect' : parsed.personaName,
              offerHeadline: explicitOffer || parsed.offerHeadline,
              targetAudience: explicitTargetAudience || parsed.targetAudience || fallback.targetAudience,
              voiceRules: explicitVoiceRules.length > 0
                ? explicitVoiceRules
                : Array.isArray(parsed.voiceRules) ? parsed.voiceRules : fallback.voiceRules,
              proofStories: this.mergeExplicitProofStories(explicitProofStories, parsed.proofStories.map((s: any) => ({
                keyCode: (s.keyCode || s.companyOrProduct || 'STORY').toUpperCase().replace(/\s+/g, '_'),
                companyOrProduct: s.companyOrProduct || 'Empresa / Producto',
                impactMetric: s.impactMetric || 'Impacto cuantificado relevante',
                description: s.description || `${s.companyOrProduct || 'Empresa / Producto'}: ${s.impactMetric || 'Impacto cuantificado relevante'}`,
                domainTags: Array.isArray(s.domainTags) ? s.domainTags : ['General'],
              }))),
              taxonomy: {
                coreRoles: Array.isArray(parsed.taxonomy?.coreRoles) ? parsed.taxonomy.coreRoles : fallback.taxonomy.coreRoles,
                hybridRoles: Array.isArray(parsed.taxonomy?.hybridRoles) ? parsed.taxonomy.hybridRoles : fallback.taxonomy.hybridRoles,
                tangentialRoles: Array.isArray(parsed.taxonomy?.tangentialRoles) ? parsed.taxonomy.tangentialRoles : fallback.taxonomy.tangentialRoles,
                excludedRoles: Array.isArray(parsed.taxonomy?.excludedRoles) ? parsed.taxonomy.excludedRoles : fallback.taxonomy.excludedRoles,
              },
              scrapingConfig: {
                searchKeywords: Array.isArray(parsed.scrapingConfig?.searchKeywords) && parsed.scrapingConfig.searchKeywords.length > 0
                  ? parsed.scrapingConfig.searchKeywords
                  : fallback.scrapingConfig.searchKeywords,
                minHourlyRate: Number(parsed.scrapingConfig?.minHourlyRate) || 45,
                minBudgetFixed: Number(parsed.scrapingConfig?.minBudgetFixed) || 1000,
                targetCountries: Array.isArray(parsed.scrapingConfig?.targetCountries)
                  ? parsed.scrapingConfig.targetCountries
                  : fallback.scrapingConfig.targetCountries,
              },
              scoringRationale: {
                strengthsDetected: Array.isArray(parsed.scoringRationale?.strengthsDetected)
                  ? parsed.scoringRationale.strengthsDetected
                  : ['Experiencia técnica senior'],
                scoringExplanation: parsed.scoringRationale?.scoringExplanation || 'Scoring deductivo calibrado automáticamente.',
              },
            };
          }
        }
      } catch (err: any) {
        this.logger.error(`Error sintetizando perfil con Gemini: ${err.message}. Usando fallback.`);
      }
    }

    return {
      ...fallback,
      proofStories: explicitProofStories.length > 0 ? explicitProofStories : fallback.proofStories,
      voiceRules: explicitVoiceRules.length > 0 ? explicitVoiceRules : fallback.voiceRules,
    };
  }
}
