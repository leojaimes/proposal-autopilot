import { Injectable } from '@nestjs/common';
import { StrategicLane, RoleClassification } from '../constants/taxonomy.constants';

@Injectable()
export class RoleClassifierService {
  classify(title: string, description: string, skills: string[] = []): RoleClassification {
    const text = `${title} ${description} ${skills.join(' ')}`.toLowerCase();

    // 1. Detección de Ruido / Disqualified
    if (
      text.includes('course') || 
      text.includes('instructor') || 
      text.includes('tutor') || 
      text.includes('qa checklist') || 
      text.includes('graphic designer') || 
      text.includes('influencer') || 
      text.includes('avatar creator')
    ) {
      return {
        lane: StrategicLane.DISQUALIFIED_NOISE,
        normalizedRole: 'Disqualified / Off-Niche Task',
        suggestedProofStory: 'NONE',
        isDisqualified: true,
      };
    }

    // 2. Familia Core: AI & Agentic UX
    if (text.includes('ai') || text.includes('agent') || text.includes('copilot') || text.includes('llm') || text.includes('conversational')) {
      return {
        lane: StrategicLane.CORE_AI_UX,
        normalizedRole: 'AI Interaction & Agentic UX Designer',
        suggestedProofStory: 'META_MESSENGER_TRUST',
        isDisqualified: false,
      };
    }

    // 3. Familia Product Strategy & Interim PM
    if (text.includes('product manager') || text.includes('interim') || text.includes('0-to-1') || text.includes('roadmap') || text.includes('cpo')) {
      return {
        lane: StrategicLane.PRODUCT_STRATEGY,
        normalizedRole: 'Interim Product Manager (0-to-1)',
        suggestedProofStory: 'PEPPER_AI',
        isDisqualified: false,
      };
    }

    // 4. Familia Design Systems
    if (text.includes('design system') || text.includes('component library') || text.includes('figma variables') || text.includes('tokens')) {
      return {
        lane: StrategicLane.CORE_AI_UX,
        normalizedRole: 'Design System Lead / Architect',
        suggestedProofStory: 'CISCO_COMMERCE',
        isDisqualified: false,
      };
    }

    // 5. Interface Build (SaaS / Framer)
    if (text.includes('redesign') || text.includes('framer') || text.includes('dashboard') || text.includes('saas website')) {
      return {
        lane: StrategicLane.INTERFACE_BUILD,
        normalizedRole: 'SaaS Product & Interface Designer',
        suggestedProofStory: 'META_FINTECH',
        isDisqualified: false,
      };
    }

    // Fallback
    return {
      lane: StrategicLane.INTERFACE_BUILD,
      normalizedRole: 'General Product Designer',
      suggestedProofStory: 'PEPPER_AI',
      isDisqualified: false,
    };
  }
}
