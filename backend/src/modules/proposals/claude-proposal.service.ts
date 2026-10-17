import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateProposalInput {
  jobTitle: string;
  jobDescription: string;
  proofStoryKey: string;
  normalizedRole: string;
}

export interface ProposalOutput {
  contactName: string;
  coverLetter35Words: string;
  technicalProposalBody: string;
  mermaidDiagramCode: string;
}

@Injectable()
export class ClaudeProposalService {
  private readonly logger = new Logger(ClaudeProposalService.name);
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('REPLACE_WITH_YOUR')) {
      this.logger.warn('ANTHROPIC_API_KEY no configurada. Generador de propuestas operará en modo template.');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Genera la propuesta con la regla estricta: ~35 palabras, hook de autoridad con ProofStory, y diagrama Mermaid.
   */
  async generate(input: GenerateProposalInput): Promise<ProposalOutput> {
    // Si no hay key configurada, entrega el template de producción calibrado
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('REPLACE_WITH_YOUR')) {
      return {
        contactName: 'Hiring Team',
        coverLetter35Words: `Hi, I design the screens myself and have owned a B2C product end to end (Pepper AI, 17,000+ users). I mapped your first 90 days and roadmap breakdown. Walkthrough link inside.`,
        technicalProposalBody: `# Roadmap & Strategic Proposal for ${input.jobTitle}\n\n## 1. Executive Summary\nReview of requirements and 90-day execution milestone plan.\n\n## 2. Technical Architecture\nComponent breakdown and token-based design architecture.`,
        mermaidDiagramCode: `graph TD\n  A[Requirements Audit] --> B[90-Day Roadmap]\n  B --> C[Figma Interactive Prototype]\n  C --> D[Dev Handoff]`
      };
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `You are an elite product designer and fractional operator. 
Job Title: ${input.jobTitle}
Description: ${input.jobDescription}
Proof Story to reference: ${input.proofStoryKey}

Return a JSON with:
1. "contactName": Name found in description or "Hiring Team"
2. "coverLetter35Words": EXACTLY 30 to 35 words. Formula: Hook of authority referencing ${input.proofStoryKey} + direct solution to their problem + "Walkthrough: [LINK]"
3. "technicalProposalBody": Clean 4-section markdown proposal.
4. "mermaidDiagramCode": 5-node Mermaid flowchart showing execution steps.`
          }
        ]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      return JSON.parse(text);
    } catch (error) {
      this.logger.error('Error invocando Claude API:', error);
      throw error;
    }
  }
}
