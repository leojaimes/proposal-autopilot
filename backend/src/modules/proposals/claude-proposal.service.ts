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
      contactName: 'Hiring Team',
      coverLetter35Words: `Hi, I built and scaled ${company} (${metric}). I reviewed your requirements and designed the complete system architecture for ${input.jobTitle}. I mapped your first 90 days and roadmap breakdown. Walkthrough link inside.`,
      technicalProposalBody: `# Roadmap & Strategic Proposal for ${input.jobTitle}\n\n## 1. Executive Summary & Problem Diagnosis\nStrategic diagnosis and 90-day execution roadmap tailored for ${input.jobTitle}. Focusing on direct transformation, architecture clarity, and rapid execution.\n\n## 2. Technical Architecture & Recommended Approach\nModular system design, token-based architecture, and developer-ready specifications.\n\n## 3. 90-Day Execution Milestones\n- Phase 1: Requirements Audit & Architecture Blueprint\n- Phase 2: Core Implementation & Interactive Prototype\n- Phase 3: QA, Performance Hardening & Production Delivery\n\n## 4. Deliverables & Acceptance Criteria\nComplete production source files, responsive components, documentation, and handover walk-through.`,
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
- NO em dashes (—) anywhere. Zero. Use commas, periods, or standard hyphens (-).
- NO conversational filler: Never say "I hope this finds you well", "I am thrilled to apply", "I would love to help", "Look no further", "Are you looking for...".
- NO stock AI buzzwords: Do NOT use "delve", "testament", "tapestry", "seamless", "cutting-edge", "game-changer", "elevate", "pivotal", "beacon", "in today's fast-paced world".
- NO "Not X but Y" artificial contrasts ("It's not just a design, it's an experience").
- NO dramatic one-line closers ("That is the real win.", "Let that sink in.").
- TONE: Direct, authoritative, peer-to-peer practitioner. Sounds like a principal engineer or founder responding concisely on Slack.

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
   - Detect the hiring manager's first name if mentioned in the job description or client reviews (e.g. "Hi, I'm David", "- Sarah").
   - If not explicitly mentioned, return "Hiring Team".

2. "coverLetter35Words":
   - STRICT CONSTRAINT: Word count MUST be between 30 and 35 words total.
   - Follow this proven 3-part conversion structure:
     a) Transferable Authority Hook: Lead with your proof story and exact metric bridged directly to their problem ("Having [metric at ProofStoryCompany], I will [solve core deliverable]...").
     b) Immediate, punchy solution addressing the client's secondary bottleneck or technical requirement.
     c) Action CTA pointing to the walkthrough: "I mapped your first 90 days and technical roadmap. Walkthrough link inside."

3. "technicalProposalBody":
   - Comprehensive, professional 4-section Markdown proposal customized specifically to this job:
     # Strategic Proposal & Roadmap: ${input.jobTitle}
     ## 1. Executive Summary & Problem Diagnosis
     ## 2. Technical Architecture & Recommended Approach
     ## 3. 90-Day Execution Milestones (Phase 1, Phase 2, Phase 3)
     ## 4. Deliverables & Acceptance Criteria
   - STRICT NEGATIVE CONSTRAINT: NEVER write ASCII diagrams, box drawings, backtick flowchart blocks, or text pipelines (like '[Call] -> [Audio] | ▼') inside "technicalProposalBody". All architecture diagrams and visual workflows MUST be placed exclusively in "mermaidDiagramCode".
   - When stating validation benchmarks or metrics, format them clearly as bold bullet headers, for example:
     - **Concrete Metric**: [Result, e.g. Reduced operational time from X to Y]
     - **Testing & Validation**: [Audit details, benchmark scope]

4. "mermaidDiagramCode":
   - Valid, clean Mermaid syntax for a 5-node flowchart (flowchart TD) illustrating the project's execution phases.
   - Example format:
flowchart TD
  A[Discovery & Audit] --> B[Core Architecture]
  B --> C[Interactive Prototype]
  C --> D[QA & Validation]
  D --> E[Production Delivery]`;

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

    // Sanitize Humanizer rules: Strip any em dashes, clean up mermaid code fences
    let letter = (parsed.coverLetter35Words || '')
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    let mermaid = (parsed.mermaidDiagramCode || 'flowchart TD\n  A[Discovery & Audit] --> B[Architecture & Prototype] --> C[QA & Delivery]')
      .replace(/^```(mermaid)?/im, '')
      .replace(/```$/im, '')
      .trim();

    return {
      contactName: parsed.contactName || 'Hiring Team',
      coverLetter35Words: letter,
      technicalProposalBody: parsed.technicalProposalBody || '',
      mermaidDiagramCode: mermaid,
    };
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
}
