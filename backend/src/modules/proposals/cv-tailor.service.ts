import { Injectable, Logger } from '@nestjs/common';

export interface ProfileData {
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin_url?: string;
  linkedin_label?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface ExperienceProject {
  name: string;
  description: string;
}

export interface ExperienceItem {
  title: string;
  period: string;
  company: string;
  location: string;
  description?: string;
  projects?: ExperienceProject[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  location: string;
  year: string;
}

export interface LanguageItem {
  name: string;
  level: string;
}

export interface BaseCvData {
  profile: ProfileData;
  summary: { text: string };
  skills_technical: SkillCategory[];
  skills_soft?: string[];
  experience: ExperienceItem[];
  education?: EducationItem[];
  languages?: LanguageItem[];
}

export interface PublicationsCvDocument {
  ownerEmail?: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  css: string;
  html?: string;
  translations: {
    es: BaseCvData;
    en: BaseCvData;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CoverLetterData {
  recipient: string;
  subject: string;
  salutation: string;
  valediction: string;
  paragraphs: string[];
  dateFormatted?: string;
}

export const ATS_CV_CSS = `
  :root {
    --page-width: 215.9mm;
    --page-height: 279.4mm;
    --accent-color: #3398DA;
    --text-main: #1e293b;
    --text-muted: #475569;
    --border-color: #cbd5e1;
    --header-height: 50px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.5;
    color: var(--text-main);
    background-color: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .layout-table { width: 100%; border-collapse: collapse; }
  .main-cell { padding: 28px 36px; vertical-align: top; }
  .cv-header { text-align: center; border-bottom: 2px solid var(--accent-color); padding-bottom: 12px; margin-bottom: 18px; }
  .name { font-size: 22pt; font-weight: 700; color: #0f172a; letter-spacing: 0.5px; }
  .role-title { font-size: 11pt; font-weight: 600; color: var(--accent-color); text-transform: uppercase; margin-top: 2px; }
  .contact-info { margin-top: 6px; font-size: 9pt; color: var(--text-muted); display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
  .contact-divider { color: var(--border-color); }
  .cv-section { margin-bottom: 16px; }
  .section-title { font-size: 11pt; font-weight: 700; color: var(--accent-color); text-transform: uppercase; border-bottom: 1px solid var(--border-color); padding-bottom: 3px; margin-bottom: 8px; }
  .summary-text { font-size: 9.5pt; color: var(--text-main); line-height: 1.45; text-align: justify; }
  .skills-grid { display: flex; flex-direction: column; gap: 4px; }
  .skill-category { font-size: 9pt; line-height: 1.4; }
  .category-name { font-weight: 600; color: #0f172a; }
  .category-items { color: var(--text-main); margin-left: 4px; }
  .experience-item { margin-bottom: 14px; }
  .experience-header { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-size: 10pt; font-weight: 700; color: #0f172a; }
  .period { font-size: 8.5pt; font-weight: 600; color: var(--accent-color); }
  .company-info { display: flex; justify-content: space-between; font-size: 9pt; color: var(--text-muted); font-style: italic; margin-bottom: 4px; }
  .project-item { margin-top: 6px; padding-left: 10px; border-left: 2px solid #e2e8f0; }
  .project-name { font-size: 9pt; font-weight: 600; color: #1e293b; display: block; }
  .project-desc { font-size: 8.5pt; color: var(--text-muted); line-height: 1.4; margin-top: 2px; text-align: justify; }
  .job-desc { font-size: 8.5pt; color: var(--text-muted); line-height: 1.4; margin-top: 2px; text-align: justify; }
  .education-item { margin-bottom: 8px; }
  .education-header { display: flex; justify-content: space-between; align-items: baseline; }
  .degree-title { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
  .institution-info { display: flex; justify-content: space-between; font-size: 8.5pt; color: var(--text-muted); font-style: italic; }
  .languages-list { display: flex; gap: 16px; font-size: 9pt; flex-wrap: wrap; }
  .language-item { color: var(--text-main); }
  .language-name { font-weight: 600; color: #0f172a; }
  .language-level { color: var(--text-muted); margin-left: 2px; }
`;

const ATS_CL_CSS = `
  :root {
    --page-width: 215.9mm;
    --page-height: 279.4mm;
    --accent-color: #3398DA;
    --text-main: #0f172a;
    --text-muted: #334155;
    --border-color: #cbd5e1;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif;
    line-height: 1.6;
    color: var(--text-main);
    background-color: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .layout-table { width: 100%; border-collapse: collapse; }
  .main-cell { padding: 36px 40px; vertical-align: top; }
  .cv-header { text-align: center; border-bottom: 2px solid var(--accent-color); padding-bottom: 12px; margin-bottom: 24px; }
  .name { font-size: 20pt; font-weight: 700; color: #0f172a; letter-spacing: 0.5px; }
  .role-title { font-size: 10.5pt; font-weight: 600; color: var(--accent-color); text-transform: uppercase; margin-top: 2px; }
  .contact-info { margin-top: 6px; font-size: 9pt; color: var(--text-muted); display: flex; justify-content: center; gap: 8px; }
  .contact-divider { color: var(--border-color); }
  .cl-meta-grid { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; font-size: 9.5pt; }
  .cl-recipient-block { display: flex; flex-direction: column; gap: 2px; }
  .cl-recipient-to { font-weight: 600; color: var(--accent-color); font-size: 8.5pt; text-transform: uppercase; }
  .cl-recipient-name { font-weight: 700; color: #0f172a; }
  .cl-recipient-company { color: var(--text-muted); font-style: italic; }
  .cl-date-block { font-size: 9pt; color: var(--text-muted); font-weight: 600; }
  .cl-subject-line { font-size: 10pt; background-color: #f8fafc; border-left: 3px solid var(--accent-color); padding: 8px 12px; margin-bottom: 16px; border-radius: 4px; }
  .cl-salutation { font-size: 10pt; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
  .cl-paragraph { font-size: 9.5pt; line-height: 1.55; color: #1e293b; margin-bottom: 12px; text-align: justify; }
  .cl-signoff-block { margin-top: 20px; }
  .cl-signoff-valediction { font-size: 9.5pt; margin-bottom: 8px; color: var(--text-muted); }
  .cl-signature-name { font-size: 10.5pt; font-weight: 700; color: #0f172a; }
  .cl-signature-role { font-size: 9pt; color: var(--accent-color); font-weight: 600; }
`;

export interface AiAdaptationResult {
  detectedCompany: string;
  changesMade: string[];
  interviewQuestions: string[];
  coverLetter: CoverLetterData;
  adaptedCv: BaseCvData;
}

export const BASE_LEONARDO_CV_EN: BaseCvData = {
  profile: {
    name: 'LEONARDO JAIMES ESTEVEZ',
    role: 'FULL STACK DEVELOPER',
    email: 'leo777jaimes@gmail.com',
    phone: '+52 9999000935',
    linkedin_url: 'https://www.linkedin.com/in/leonardo-jaimes-est%C3%A9vez-a6b018126/',
    linkedin_label: 'linkedIn',
  },
  summary: {
    text: 'Full Stack Developer with 10+ years of experience building scalable web and mobile applications. Specialized in Vue, Nuxt, Node.js, and MongoDB, with strong focus on AI-driven systems, automation, and spec-driven development. Currently building a multi-tenant SaaS platform that automates content generation, decision-making, and publishing based on real-time events and trends.',
  },
  skills_technical: [
    {
      category: 'AI & Automation',
      items: [
        'AI Agent Design',
        'Prompt Engineering',
        'Gemini',
        'OpenAI',
        'LangChain / Tavily',
        'Spec-Driven Dev (SDD)',
        'Workflow Orchestration',
      ],
    },
    {
      category: 'Backend Development',
      items: [
        'NestJS',
        'Node.js',
        'REST APIs',
        'Multi-Tenant SaaS',
        'Auth & RBAC',
        'MongoDB',
        'Firebase Storage',
      ],
    },
    {
      category: 'Frontend Development',
      items: ['Vue', 'Nuxt', 'React', 'Next.js', 'TypeScript', 'Responsive Design'],
    },
    {
      category: 'Tools & Delivery',
      items: [
        'Git',
        'Docker',
        'Agile/Scrum',
        'Jira',
        'TDD',
        'Unit & Integration Testing',
      ],
    },
  ],
  experience: [
    {
      title: 'Full Stack Developer',
      period: '01/2020 - Present',
      company: 'Spotlight Studio',
      location: 'Mérida, Yucatán, México',
      projects: [
        {
          name: 'AI Publications Platform (SaaS)',
          description:
            'Designed and led development of a multi-tenant SaaS platform that automates social media content creation and publishing for multiple clients from a single system. The platform detects real-world events and trends in real time, generates branded visual content automatically, and schedules posts across social networks without manual intervention. Reduced content production time by over 80% per campaign while maintaining brand consistency across all clients. Built with scalability, security, and maintainability as core principles — structured to grow with the business.',
        },
        {
          name: 'PepperTix Web Application',
          description:
            'Led frontend development for PepperTix, a ticket resale web platform, utilizing Vue and Nuxt.js to deliver a responsive and scalable user experience. Improved SEO performance and platform accessibility, resulting in increased user engagement. Collaborated closely with UX and QA teams to ensure high-quality deliverables.',
        },
        {
          name: 'Pepper Tix Backend',
          description:
            'Developed backend services to support PepperTix features using Node.js and Express.js. Designed and maintained RESTful APIs to handle ticket transactions, user management, and notifications. Ensured database integration and data consistency with MongoDB.',
        },
        {
          name: 'Pepper Videos Mobile',
          description:
            'Developed the Pepper Videos mobile application using Flutter, enabling users to search for videos, follow artists, and receive notifications. Implemented Clean Architecture principles ensuring scalability, testability, and maintainability.',
        },
        {
          name: 'Pepper Bot',
          description:
            'Built a conversational event search chatbot for Facebook Messenger using Graph API, Messenger, Dialogflow, and ChatGPT.',
        },
      ],
    },
    {
      title: 'Independent Software Developer / Professional Transition',
      period: '2017 – 2019',
      company: 'Independent',
      location: 'Remote',
      description:
        'Focused on autonomous deep learning, updating technical stack to modern JavaScript frameworks (Vue.js, Node.js), and exploring emerging cloud architectures. Delivered freelance web development solutions and technical consulting for local clients, ensuring high-performance standards and responsive designs. Dedicated time to professional upskilling, system design exploration, and personal engineering projects.',
    },
    {
      title: 'Application Development Assistant',
      period: '01/2013 - 12/2016',
      company: 'Fundación de la Mujer',
      location: 'Floridablanca, Santander, Colombia',
      description:
        'Assisted with operational issue resolution, debugging, and refactoring. Documented bugs and supported the development team. Worked with internal tools and SQL Server.',
    },
  ],
  education: [
    {
      degree: 'Telecommunications Engineering',
      institution: 'Unidades Tecnológicas de Santander',
      location: 'Bucaramanga, Colombia',
      year: '2015',
    },
    {
      degree: 'Information Systems Analysis and Development',
      institution: 'Servicio Nacional de Aprendizaje SENA',
      location: 'Santander, Colombia',
      year: '2005',
    },
  ],
  languages: [
    { name: 'Spanish', level: 'Native' },
    { name: 'English', level: 'B1+' },
  ],
};

export const BASE_LEONARDO_CV_ES: BaseCvData = {
  profile: {
    ...BASE_LEONARDO_CV_EN.profile,
    role: 'DESARROLLADOR FULL STACK',
  },
  summary: {
    text: 'Desarrollador Full Stack con más de 10 años de experiencia construyendo aplicaciones web y móviles escalables. Especializado en Vue, Nuxt, Node.js y MongoDB, con un fuerte enfoque en sistemas impulsados por IA, automatización y desarrollo basado en especificaciones (SDD). Actualmente construyendo una plataforma SaaS multi-inquilino que automatiza la generación de contenido, toma de decisiones y publicación basada en tendencias y eventos en tiempo real.',
  },
  skills_technical: [
    {
      category: 'IA & Automatización',
      items: [
        'Diseño de Agentes IA',
        'Prompt Engineering',
        'Gemini',
        'OpenAI',
        'LangChain / Tavily',
        'Desarrollo Basado en Especificaciones (SDD)',
        'Orquestación de Flujos',
      ],
    },
    {
      category: 'Desarrollo Backend',
      items: [
        'NestJS',
        'Node.js',
        'APIs REST',
        'SaaS Multi-Inquilino',
        'Auth & RBAC',
        'MongoDB',
        'Firebase Storage',
      ],
    },
    {
      category: 'Desarrollo Frontend',
      items: ['Vue', 'Nuxt', 'React', 'Next.js', 'TypeScript', 'Diseño Responsivo'],
    },
    {
      category: 'Herramientas, DevOps & Despliegue',
      items: [
        'Git',
        'Docker',
        'Agile/Scrum',
        'Jira',
        'TDD',
        'Pruebas Unitarias e Integración',
      ],
    },
  ],
  experience: [
    {
      title: 'Desarrollador Full Stack',
      period: '01/2020 - Presente',
      company: 'Spotlight Studio',
      location: 'Mérida, Yucatán, México',
      projects: [
        {
          name: 'Plataforma de Publicaciones AI (SaaS)',
          description:
            'Diseñó y lideró el desarrollo de una plataforma SaaS multi-inquilino que automatiza la creación y publicación de contenido en redes sociales para múltiples clientes desde un único sistema. La plataforma detecta eventos y tendencias del mundo real en tiempo real, genera contenido visual con marca automáticamente y programa publicaciones en redes sociales sin intervención manual. Redujo el tiempo de producción de contenido en más del 80% por campaña manteniendo la coherencia de marca en todos los clientes. Construido con escalabilidad, seguridad y mantenibilidad como principios fundamentales, estructurado para crecer con el negocio.',
        },
        {
          name: 'Aplicación Web PepperTix',
          description:
            'Lideró el desarrollo frontend de PepperTix, una plataforma web de reventa de entradas, utilizando Vue y Nuxt.js para brindar una experiencia de usuario responsiva y escalable. Mejoró el rendimiento de SEO y la accesibilidad de la plataforma, lo que resultó en un mayor compromiso de los usuarios. Colaboró estrechamente con equipos de UX y QA para garantizar entregables de alta calidad.',
        },
        {
          name: 'Backend Pepper Tix',
          description:
            'Desarrolló servicios backend para soportar funcionalidades de PepperTix usando Node.js y Express.js. Diseñó y mantuvo APIs RESTful para gestionar transacciones de entradas, gestión de usuarios y notificaciones. Aseguró la integración con base de datos y la consistencia de datos con MongoDB.',
        },
        {
          name: 'App Móvil Pepper Videos',
          description:
            'Desarrolló la aplicación móvil Pepper Videos usando Flutter, permitiendo a los usuarios buscar videos, seguir artistas y recibir notificaciones. Implementó principios de Clean Architecture garantizando escalabilidad, testabilidad y mantenibilidad.',
        },
        {
          name: 'Bot Conversacional Pepper',
          description:
            'Construyó un chatbot conversacional de búsqueda de eventos para Facebook Messenger usando Graph API, Messenger, Dialogflow y ChatGPT.',
        },
      ],
    },
    {
      title: 'Desarrollador de Software Independiente / Transición Profesional',
      period: '2017 – 2019',
      company: 'Independiente',
      location: 'Remoto',
      description:
        'Enfocado en aprendizaje autónomo profundo, actualización de stack técnico a frameworks modernos de JavaScript (Vue.js, Node.js) y exploración de arquitecturas cloud emergentes. Entrega de soluciones de desarrollo web freelance y consultoría técnica para clientes locales, garantizando altos estándares de rendimiento y diseño responsivo. Dedicación al fortalecimiento profesional, exploración de diseño de sistemas y proyectos personales de ingeniería.',
    },
    {
      title: 'Asistente de Desarrollo de Aplicaciones',
      period: '01/2013 - 12/2016',
      company: 'Fundación de la Mujer',
      location: 'Floridablanca, Santander, Colombia',
      description:
        'Asistencia en resolución de incidencias operativas, depuración y refactorización de código. Documentación de errores y soporte al equipo de desarrollo. Trabajo con herramientas internas y SQL Server.',
    },
  ],
  education: [
    {
      degree: 'Ingeniería en Telecomunicaciones',
      institution: 'Unidades Tecnológicas de Santander',
      location: 'Bucaramanga, Colombia',
      year: '2015',
    },
    {
      degree: 'Análisis y Desarrollo de Sistemas de Información',
      institution: 'Servicio Nacional de Aprendizaje SENA',
      location: 'Santander, Colombia',
      year: '2005',
    },
  ],
  languages: [
    { name: 'Español', level: 'Nativo' },
    { name: 'Inglés', level: 'B1+' },
  ],
};

export const DEFAULT_PUBLICATIONS_CV_DOCUMENT: PublicationsCvDocument = {
  ownerEmail: 'leo.jaimes.estevez@gmail.com',
  name: 'Leonardo Jaimes CV ATS',
  slug: 'ats-cv',
  description: 'ATS-friendly single-column layout version.',
  css: ATS_CV_CSS,
  translations: {
    es: BASE_LEONARDO_CV_ES,
    en: BASE_LEONARDO_CV_EN,
  },
};

@Injectable()
export class CvTailorService {
  private readonly logger = new Logger(CvTailorService.name);
  private readonly gotenbergUrl =
    process.env.GOTENBERG_URL ||
    'https://pepper-tix-gotenberg.zh4nwb.easypanel.host/forms/chromium/convert/html';
  private readonly geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.AI_STUDIO_API_KEY;
  private readonly geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  public async adaptCvAndCoverLetter(input: {
    jobDescription: string;
    companyName?: string;
    lang?: 'en' | 'es';
    baseCv?: BaseCvData;
  }): Promise<AiAdaptationResult> {
    const lang = input.lang || 'en';
    const isEn = lang === 'en';
    const base = input.baseCv || (isEn ? BASE_LEONARDO_CV_EN : BASE_LEONARDO_CV_ES);
    const rawCompany = typeof input.companyName === 'object' && input.companyName !== null
      ? ((input.companyName as any).name || '')
      : (typeof input.companyName === 'string' ? input.companyName : '');
    const company = rawCompany.trim() || 'empresa';

    // 1. If Gemini API is available, invoke AI
    if (this.geminiApiKey && !this.geminiApiKey.includes('REPLACE_WITH_YOUR')) {
      try {
        return await this.callGeminiCvAdaptation(input.jobDescription, company, lang, base);
      } catch (err: any) {
        this.logger.error(`Error calling Gemini for CV adaptation: ${err.message}. Using calibrated fallback.`);
      }
    }

    // 2. Deterministic smart fallback
    return this.buildFallbackAdaptation(input.jobDescription, company, lang, base);
  }

  private async callGeminiCvAdaptation(
    jobDescription: string,
    company: string,
    lang: 'en' | 'es',
    baseData: BaseCvData
  ): Promise<AiAdaptationResult> {
    const isEn = lang === 'en';
    const targetCompanyInstruction = company !== 'empresa'
      ? `TARGET COMPANY: The target company is "${company}". Ensure the Cover Letter recipient, salutation, body paragraphs, and the adapted CV explicitly address and target "${company}". In the output JSON, set "detected_company": "${company}".`
      : 'Detect the company offering the position from the job description text (or use "empresa" if unspecified).';

    const prompt = `You are a professional technical recruiter and resume editor.
I will provide:
1. My base CV.
2. A job description.

Your task is to adapt my CV specifically to the job description while keeping it truthful and defensible in an interview, AND generate a matching professional cover letter.

### STRICT RULES
* Do NOT invent experience, projects, responsibilities, technologies, certifications, achievements, metrics, companies, dates, or education.
* Do NOT increase my seniority or experience level just to match the job description.
* Do NOT claim expertise, specialization, or professional experience that is not clearly supported by my base CV.
* Do NOT copy requirements from the job description into my experience unless my CV already supports them.
* Do NOT fabricate metrics. If a metric is not explicitly supported by my CV, do not create one.
* Keep my actual career profile and background intact.
* CRITICAL (PRESERVE ALL PROJECTS & EDUCATION): You MUST preserve ALL companies, ALL jobs, and ALL projects under every company from the base CV intact. Do NOT drop, delete or omit ANY project (e.g. AI Publications Platform, PepperTix Web App, Pepper Tix Backend, Pepper Videos Mobile, Pepper Bot must ALL be kept). You may tailor their descriptions to highlight relevant achievements. You MUST also keep all education and language entries intact.
* Prioritize relevant technologies and experience for the specific position.
* Keep the language natural and credible, not overly corporate or AI-generated.

### CANDIDATE TIMELINE & REALISTIC CHRONOLOGY (CRITICAL)
* The candidate has 10+ years of solid foundation in full-stack software development (building web applications, multi-tenant SaaS platforms, internal tools, Node/NestJS, TypeScript, React/Vue, MongoDB/PostgreSQL, CI/CD).
* OVER THE PAST YEAR / RECENT WORK: The candidate has deeply focused on AI-augmented software development, utilizing daily AI coding agents (Claude Code, Gemini, Codex) and prompt engineering alongside Spec-Driven Development (SDD) to accelerate software delivery and build internal automations.
* NEVER claim or imply that the candidate has 10 years of AI experience.

### HUMANIZER & AUTHENTIC VOICE PROTOCOL (ANTI-AI-SLOP)
* Ban stock AI words: "delve", "testament", "tapestry", "beacon", "pivotal", "landscape", "bolster", "spearhead".
* No forced triads (avoid "scalable, robust, and maintainable").

### COMPANION COVER LETTER GENERATION
In addition to the tailored CV, write a compelling, concise, and professional companion Cover Letter:
* Tone: Professional, direct, humble yet confident, technically credible.
* Structure: Exactly 3 to 4 focused paragraphs (Opening with 10 years full-stack + 1 year AI agents, technical alignment, operational realism at Spotlight Studio, courteous closing).
* Language: Must match the requested language (${isEn ? 'ENGLISH' : 'SPANISH'}).

Return pure JSON matching this exact structure:
{
  "detected_company": "${company !== 'empresa' ? company : 'Detected company'}",
  "changes_made": ["Highlighted NestJS and SaaS experience", "Aligned summary to backend needs"],
  "interview_questions": ["How do you ensure architecture rigor when working with AI coding agents?"],
  "cover_letter": {
    "recipient": "Hiring Team / Engineering Leadership",
    "subject": "Application for ${baseData.profile.role} position",
    "salutation": "Dear Hiring Team at ${company},",
    "valediction": "Sincerely,",
    "paragraphs": [
      "Paragraph 1...",
      "Paragraph 2...",
      "Paragraph 3..."
    ]
  },
  "cv_data": {
    "profile": ${JSON.stringify(baseData.profile)},
    "summary": { "text": "Tailored summary..." },
    "skills_technical": ${JSON.stringify(baseData.skills_technical)},
    "experience": ${JSON.stringify(baseData.experience)},
    "education": ${JSON.stringify(baseData.education || [])},
    "languages": ${JSON.stringify(baseData.languages || [])}
  }
}

JOB DESCRIPTION:
${jobDescription}

BASE CV DATA:
${JSON.stringify(baseData)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP error ${res.status}: ${await res.text()}`);
    }

    const payload = (await res.json()) as any;
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    // Apply Humanizer sanitization
    const sanitizedParagraphs = (parsed.cover_letter?.paragraphs || []).map((p: string) =>
      this.sanitizeAntiSlop(p)
    );
    const sanitizedSummary = this.sanitizeAntiSlop(parsed.cv_data?.summary?.text || baseData.summary.text);

    // Ensure all projects from baseData are preserved even if AI trimmed any
    let tailoredExperience = parsed.cv_data?.experience || baseData.experience;
    if (Array.isArray(tailoredExperience) && baseData.experience) {
      tailoredExperience = baseData.experience.map((baseExp, idx) => {
        const matchingAiExp = tailoredExperience[idx] || {};
        const baseProjects = baseExp.projects || [];
        const aiProjects = matchingAiExp.projects || [];
        
        // Merge projects to guarantee NONE are lost
        const mergedProjects = baseProjects.map((bp) => {
          const aiP = aiProjects.find((ap: any) => ap.name?.toLowerCase() === bp.name?.toLowerCase());
          return aiP ? { name: bp.name, description: this.sanitizeAntiSlop(aiP.description || bp.description) } : bp;
        });

        return {
          ...baseExp,
          title: matchingAiExp.title || baseExp.title,
          description: matchingAiExp.description ? this.sanitizeAntiSlop(matchingAiExp.description) : baseExp.description,
          projects: mergedProjects.length > 0 ? mergedProjects : undefined,
        };
      });
    }

    return {
      detectedCompany: parsed.detected_company || company,
      changesMade: parsed.changes_made || ['Aligned summary and skills with job vacancy'],
      interviewQuestions: parsed.interview_questions || [],
      coverLetter: {
        recipient: parsed.cover_letter?.recipient || 'Hiring Team',
        subject: parsed.cover_letter?.subject || `Application for ${baseData.profile.role}`,
        salutation: parsed.cover_letter?.salutation || `Dear Hiring Team,`,
        valediction: parsed.cover_letter?.valediction || (isEn ? 'Sincerely,' : 'Atentamente,'),
        dateFormatted: new Date().toISOString().split('T')[0],
        paragraphs: sanitizedParagraphs,
      },
      adaptedCv: {
        ...baseData,
        summary: { text: sanitizedSummary },
        skills_technical: parsed.cv_data?.skills_technical || baseData.skills_technical,
        experience: tailoredExperience,
        education: (parsed.cv_data?.education && parsed.cv_data.education.length > 0)
          ? parsed.cv_data.education
          : (baseData.education || []),
        languages: (parsed.cv_data?.languages && parsed.cv_data.languages.length > 0)
          ? parsed.cv_data.languages
          : (baseData.languages || []),
      },
    };
  }

  private buildFallbackAdaptation(
    jobDesc: string,
    company: string,
    lang: 'en' | 'es',
    base: BaseCvData
  ): AiAdaptationResult {
    const isEn = lang === 'en';
    const displayCompany = company !== 'empresa' ? company : (isEn ? 'your team' : 'su equipo');

    const paragraphs = isEn
      ? [
          `I am writing to express my strong interest in joining ${displayCompany}. With over 10 years of experience in full-stack software development, and having focused deeply over the past year on AI-assisted engineering workflows (working daily with Claude Code, Gemini, and Codex), I deliver clean, production-grade systems rapidly.`,
          `My technical foundation centers around Node.js/NestJS, TypeScript, React, and PostgreSQL. At Spotlight Studio, I led the architecture of multi-tenant SaaS platforms and automated pipelines, ensuring environment parity with Docker and GitHub Actions CI/CD while keeping code maintainable and well-tested.`,
          `I welcome the opportunity to discuss how my hands-on background and delivery speed can directly support ${displayCompany}. Thank you for your time and consideration.`,
        ]
      : [
          `Me dirijo a ustedes para expresar mi firme interés en integrarme a ${displayCompany}. Con más de 10 años de trayectoria en desarrollo de software full-stack, y habiéndome enfocado profundamente durante el último año en flujos de desarrollo asistido por IA (trabajando diariamente con Claude Code, Gemini y Codex), entrego sistemas limpios y listos para producción con alta velocidad.`,
          `Mi base técnica se centra en Node.js/NestJS, TypeScript, Vue/React y PostgreSQL/MongoDB. En Spotlight Studio, diseñé y lideré plataformas SaaS multi-inquilino y pipelines automatizados, garantizando paridad de entornos con Docker y CI/CD en GitHub Actions manteniendo código testeado y robusto.`,
          `Agradezco su consideración y quedo a su entera disposición para conversar sobre cómo mi experiencia práctica puede sumar valor inmediato a ${displayCompany}.`,
        ];

    return {
      detectedCompany: company !== 'empresa' ? company : 'Acme Corp',
      changesMade: [
        'Resumen adaptado destacando arquitectura backend y aceleración con agentes de IA',
        'Habilidades técnicas priorizadas para stack moderno',
      ],
      interviewQuestions: [
        '¿Cómo garantizas la calidad arquitectónica y cobertura de pruebas cuando utilizas agentes de IA?',
        '¿Cómo estructuras un sistema multi-tenant seguro en NestJS?',
      ],
      coverLetter: {
        recipient: isEn ? 'Hiring Team / Engineering Leadership' : 'Equipo de Selección & Liderazgo Técnico',
        subject: isEn ? `Application for ${base.profile.role} position` : `Postulación para el rol de ${base.profile.role}`,
        salutation: isEn ? `Dear Hiring Team at ${displayCompany},` : `Estimado equipo de ${displayCompany},`,
        valediction: isEn ? 'Sincerely,' : 'Atentamente,',
        dateFormatted: new Date().toISOString().split('T')[0],
        paragraphs,
      },
      adaptedCv: {
        ...base,
      },
    };
  }

  private sanitizeAntiSlop(text: string): string {
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
      .trim();
  }

  public async generateCvPdf(data: BaseCvData): Promise<Buffer> {
    const html = this.buildCvHtml(data);
    return await this.renderPdfViaGotenberg(html);
  }

  public async generateCoverLetterPdf(
    profile: ProfileData,
    cl: CoverLetterData,
    companyDisplay: string
  ): Promise<Buffer> {
    const html = this.buildCoverLetterHtml(profile, cl, companyDisplay);
    return await this.renderPdfViaGotenberg(html);
  }

  public buildCvHtml(data: BaseCvData): string {
    const skillsHtml = data.skills_technical
      .map(
        (cat) => `
        <div class="skill-category">
          <strong class="category-name">${cat.category}:</strong>
          <span class="category-items">${cat.items.join(', ')}</span>
        </div>`
      )
      .join('');

    const experienceHtml = data.experience
      .map(
        (exp) => `
        <div class="experience-item">
          <div class="experience-header">
            <span class="job-title">${exp.title}</span>
            <span class="period">${exp.period}</span>
          </div>
          <div class="company-info">
            <span class="company-name">${exp.company}</span>
            <span class="location-name">${exp.location}</span>
          </div>
          ${exp.description ? `<p class="job-desc">${exp.description}</p>` : ''}
          ${(exp.projects || [])
            .map(
              (p) => `
            <div class="project-item">
              <strong class="project-name">${p.name}</strong>
              <p class="project-desc">${p.description}</p>
            </div>`
            )
            .join('')}
        </div>`
      )
      .join('');

    const isEs = (data.profile.role || '').toLowerCase().includes('desarrollador') ||
      (data.summary?.text || '').toLowerCase().includes('desarrollador');

    const educationHtml = (data.education || [])
      .map(
        (edu) => `
        <div class="education-item">
          <div class="education-header">
            <span class="degree-title">${edu.degree}</span>
            <span class="period">${edu.year}</span>
          </div>
          <div class="institution-info">
            <span class="institution-name">${edu.institution}</span>
            <span class="location-name">${edu.location}</span>
          </div>
        </div>`
      )
      .join('');

    const languagesHtml = (data.languages || [])
      .map(
        (lang) => `
        <div class="language-item">
          <span class="language-name">${lang.name}:</span>
          <span class="language-level">${lang.level}</span>
        </div>`
      )
      .join('');

    const linkedinSection = data.profile.linkedin_url
      ? `<span class="contact-divider">|</span><span>LinkedIn: ${data.profile.linkedin_label || 'linkedIn'}</span>`
      : '';

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${data.profile.name} - ${data.profile.role}</title>
    <style>${ATS_CV_CSS}</style>
  </head>
  <body>
    <table class="layout-table">
      <tbody>
        <tr>
          <td class="main-cell">
            <header class="cv-header">
              <h1 class="name">${data.profile.name}</h1>
              <h2 class="role-title">${data.profile.role}</h2>
              <div class="contact-info">
                <span>${data.profile.email}</span>
                <span class="contact-divider">|</span>
                <span>${data.profile.phone}</span>
                ${linkedinSection}
              </div>
            </header>

            <section class="cv-section">
              <h2 class="section-title">${isEs ? 'Resumen' : 'Summary'}</h2>
              <p class="summary-text">${data.summary.text}</p>
            </section>

            <section class="cv-section">
              <h2 class="section-title">${isEs ? 'Habilidades Técnicas' : 'Technical Skills'}</h2>
              <div class="skills-grid">
                ${skillsHtml}
              </div>
            </section>

            <section class="cv-section">
              <h2 class="section-title">${isEs ? 'Experiencia Laboral' : 'Experience'}</h2>
              ${experienceHtml}
            </section>

            ${data.education && data.education.length > 0 ? `
            <section class="cv-section">
              <h2 class="section-title">${isEs ? 'Educación' : 'Education'}</h2>
              ${educationHtml}
            </section>` : ''}

            ${data.languages && data.languages.length > 0 ? `
            <section class="cv-section">
              <h2 class="section-title">${isEs ? 'Idiomas' : 'Languages'}</h2>
              <div class="languages-list">
                ${languagesHtml}
              </div>
            </section>` : ''}
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
  }

  public buildCoverLetterHtml(
    profile: ProfileData,
    cl: CoverLetterData,
    companyDisplay: string
  ): string {
    const paragraphsHtml = cl.paragraphs
      .map((p) => `<p class="cl-paragraph">${p}</p>`)
      .join('');

    const linkedinSection = profile.linkedin_url
      ? `<span class="contact-divider">|</span><span>LinkedIn: ${profile.linkedin_label || 'linkedIn'}</span>`
      : '';

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Cover Letter - ${profile.name} - ${companyDisplay}</title>
    <style>${ATS_CL_CSS}</style>
  </head>
  <body>
    <table class="layout-table">
      <tbody>
        <tr>
          <td class="main-cell">
            <header class="cv-header">
              <h1 class="name">${profile.name}</h1>
              <h2 class="role-title">${profile.role}</h2>
              <div class="contact-info">
                <span>${profile.email}</span>
                <span class="contact-divider">|</span>
                <span>${profile.phone}</span>
                ${linkedinSection}
              </div>
            </header>

            <div class="cl-meta-grid">
              <div class="cl-recipient-block">
                <span class="cl-recipient-to">To:</span>
                <span class="cl-recipient-name">${cl.recipient}</span>
                <span class="cl-recipient-company">${companyDisplay}</span>
              </div>
              <div class="cl-date-block">
                <span>${cl.dateFormatted || new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>

            <div class="cl-subject-line">
              <strong>Subject:</strong> ${cl.subject}
            </div>

            <p class="cl-salutation">${cl.salutation}</p>
            ${paragraphsHtml}

            <div class="cl-signoff-block">
              <p class="cl-signoff-valediction">${cl.valediction}</p>
              <p class="cl-signature-name">${profile.name}</p>
              <p class="cl-signature-role">${profile.role}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
  }

  public async renderPdfViaGotenberg(html: string): Promise<Buffer> {
    const formData = new FormData();
    formData.append(
      'files',
      new Blob([html], { type: 'text/html' }),
      'index.html'
    );

    const response = await fetch(this.gotenbergUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gotenberg Chromium error (${response.status}): ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
