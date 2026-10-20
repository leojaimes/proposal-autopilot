import { Injectable } from '@nestjs/common';
import { StrategicLane, RoleClassification } from '../constants/taxonomy.constants';

@Injectable()
export class RoleClassifierService {
  classify(title: string, description: string, skills: string[] = []): RoleClassification {
    const text = `${title} ${description} ${skills.join(' ')}`.toLowerCase();

    // 1. Detección de Tareas Operativas / No Técnicas (Ruido / Descalificado)
    const operationalNoiseRegex = /\b(acquisition manager|real estate agent|sales agent|insurance agent|travel agent|cold caller|telemarketer|bookkeeper|bookkeeping|tax prep|medical billing|customer service rep|virtual assistant|data entry|course instructor|tutoring|teach courses|qa checklist|graphic designer|influencer|avatar creator|photo editing|photo editor|photoshop|photo retouch|listing photos|youtube host|voiceover|voice actor|narrator|reddit advertising|facebook ads|media buyer|ad manager|ads specialist|advertising manager|poker|telehealth operator|launch operator)\b/i;
    
    // Señales de intención de desarrollo de software / arquitectura
    const softwareRoleRegex = /\b(software|developer|engineer|architect|fullstack|backend|frontend|api|apis|saas platform|microservice|microservices|nestjs|prisma|node\.js|python|fastapi|react|angular|vue|devops|database architect|automate|power automate|workflow automation)\b/i;
    const hasSoftwareEngineeringIntent = softwareRoleRegex.test(title) || (
      softwareRoleRegex.test(text) && /\b(build|develop|architect|code|program|implement|refactor|stabilize|automate|create|integrate)\b/i.test(text)
    );

    // Si es un rol puramente operativo y NO es un proyecto de desarrollo/ingeniería de software -> Descalificar
    if (operationalNoiseRegex.test(title) && !hasSoftwareEngineeringIntent) {
      return {
        lane: StrategicLane.DISQUALIFIED_NOISE,
        normalizedRole: 'Disqualified / Off-Niche Task',
        suggestedProofStory: 'NONE',
        isDisqualified: true,
      };
    }

    if (operationalNoiseRegex.test(text) && !hasSoftwareEngineeringIntent && !/\b(saas|software|portal|crm|platform|api)\b/i.test(title)) {
      return {
        lane: StrategicLane.DISQUALIFIED_NOISE,
        normalizedRole: 'Disqualified / Off-Niche Task',
        suggestedProofStory: 'NONE',
        isDisqualified: true,
      };
    }

    // 2. Familia Core: AI & Agentic UX (Regex context-aware: 'agent' debe ser de IA o software)
    const aiAgentRegex = /\b(ai agent|ai agents|agentic|autonomous agent|autonomous agents|multi-agent|copilot|llm|llms|genai|gpt|chatgpt|conversational ai|rag|langchain|langgraph|crewai)\b/i;
    const isAiContext = aiAgentRegex.test(text) || (/\bai\b/i.test(text) && /\b(ux|ui|product|designer|design|interaction|prototype|interface|workflow|automation)\b/i.test(text));

    if (isAiContext) {
      return {
        lane: StrategicLane.CORE_AI_UX,
        normalizedRole: 'AI Interaction & Agentic UX Designer',
        suggestedProofStory: 'META_MESSENGER_TRUST',
        isDisqualified: false,
      };
    }

    // 3. Familia Backend, APIs & Arquitectura de Software
    const backendApiRegex = /\b(nestjs|backend|rest api|graphql|microservice|microservices|postgresql|prisma|fastapi|node\.js|docker swarm)\b/i;
    if (backendApiRegex.test(text)) {
      return {
        lane: StrategicLane.SOFTWARE_BACKEND_API,
        normalizedRole: 'Senior Backend & API Architect',
        suggestedProofStory: 'CISCO_COMMERCE',
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

    // 5. Familia Product Strategy & Interim PM
    if (text.includes('product manager') || text.includes('interim') || text.includes('0-to-1') || text.includes('roadmap') || text.includes('cpo')) {
      return {
        lane: StrategicLane.PRODUCT_STRATEGY,
        normalizedRole: 'Interim Product Manager (0-to-1)',
        suggestedProofStory: 'PEPPER_AI',
        isDisqualified: false,
      };
    }

    // 6. Familia Interface Build (SaaS / Web / Dashboard / UI / UX)
    const interfaceRegex = /\b(ui|ux|user experience|user interface|product design|product designer|figma|framer|dashboard|wireframe|wireframes|prototype|prototyping|web design|website design|landing page|redesign|saas website|ui design|portfolio website)\b/i;
    if (interfaceRegex.test(text)) {
      return {
        lane: StrategicLane.INTERFACE_BUILD,
        normalizedRole: 'SaaS Product & Interface Designer',
        suggestedProofStory: 'META_FINTECH',
        isDisqualified: false,
      };
    }

    // 7. Fallback según intención de desarrollo/ingeniería detectada
    if (hasSoftwareEngineeringIntent) {
      return {
        lane: StrategicLane.SOFTWARE_BACKEND_API,
        normalizedRole: 'Fullstack / Software Engineer',
        suggestedProofStory: 'CISCO_COMMERCE',
        isDisqualified: false,
      };
    }

    // Si no contiene ninguna señal de diseño, producto, IA ni ingeniería de software -> Descalificar
    return {
      lane: StrategicLane.DISQUALIFIED_NOISE,
      normalizedRole: 'Disqualified / Off-Niche Task',
      suggestedProofStory: 'NONE',
      isDisqualified: true,
    };
  }
}
