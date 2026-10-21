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
     Provide a 5 to 6 step technical breakdown with brief reasoning for each step, explicitly naming real industry tools and methods where applicable:
     - Step 1: Research Synthesis & Heuristic Audit (using Claude for thematic analysis & Qualtrics for structured user research)
     - Step 2: Information Architecture & Workflow Mapping (defining user states & agentic trigger handoffs)
     - Step 3: Rapid Prototyping & Component Architecture (using Figma & Figma Make for AI-assisted design tokens and autolayout systems)
     - Step 4: Agentic Automation & Workflow Integration (using n8n for agentic workflow orchestration and webhook triggers)
     - Step 5: Usability Testing & Iterative Hardening (standard usability testing, SUS benchmarking, and heuristic evaluation)
     
     ## 3. Deliverables & Realistic Timeline (Agile 2 to 3-Week Sprint)
     Structure the delivery as a high-velocity 2 to 3-week sprint (10 to 15 business days). Avoid slow 2-month timelines; clients on Upwork want senior speed and rapid momentum.
     - Phase 1 (Week 1, Days 1-5): Discovery, User Journeys & Wireframe Architecture. Promise the first interactive Figma click-through ready by Day 5.
     - Phase 2 (Week 2, Days 6-10): Figma Design System & Core Interactive UI. Scalable tokens, autolayout components, and responsive desktop screens.
     - Phase 3 (Week 3, Days 11-15): AI Workflow Automation, Usability Testing & Clean Handoff. Testing with real users to eliminate friction, n8n workflow blueprints, and developer-ready specs.
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
}
