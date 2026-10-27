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
  experience: ExperienceItem[];
  education?: EducationItem[];
  languages?: LanguageItem[];
}

export interface CoverLetterData {
  recipient: string;
  subject: string;
  salutation: string;
  valediction: string;
  paragraphs: string[];
  dateFormatted?: string;
}

const ATS_CV_CSS = `
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
    text: 'Full Stack Developer with 10+ years of experience building scalable web applications, internal tools, and multi-tenant SaaS platforms. Pioneer in adopting AI-augmented engineering workflows (working daily with Gemini, Claude Code, and Codex) paired with Spec-Driven Development (SDD) to rapidly design, build, and maintain production-ready systems. Specialized in Node.js/NestJS, TypeScript, Vue/React, and MongoDB/PostgreSQL, with practical knowledge in AWS core cloud architecture (S3, Lambda, IAM). Combines strong architectural rigor with high-velocity autonomous delivery.',
  },
  skills_technical: [
    {
      category: 'AI & Modern Engineering',
      items: [
        'AI Coding Agents (Claude Code, Gemini, Codex)',
        'Spec-Driven Dev (SDD)',
        'Prompt Engineering & Agent Design',
        'Workflow Orchestration',
        'Rapid Prototyping & Delivery',
      ],
    },
    {
      category: 'Backend Development',
      items: [
        'NestJS, Node.js',
        'REST APIs',
        'Multi-Tenant SaaS',
        'Auth & RBAC',
        'PostgreSQL, MongoDB',
        'Cloud Storage (AWS S3, Firebase)',
      ],
    },
    {
      category: 'Frontend Development',
      items: ['Vue, Nuxt', 'React, Next.js', 'TypeScript', 'Responsive Design'],
    },
    {
      category: 'Tools, DevOps & Delivery',
      items: [
        'CI/CD (GitHub Actions Pipelines & Matrix Builds)',
        'Docker (Multi-Stage Builds, GHCR)',
        'AWS (Core Services: S3, Lambda, IAM)',
        'Git & Quality Gates',
        'TDD & Automated Testing (Jest, Playwright)',
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
          name: 'Plataforma de Publicaciones AI (SaaS) & Internal Tooling',
          description:
            'Designed and led full-stack development of a multi-tenant SaaS platform and automated tooling at Spotlight Studio. Championed an AI-augmented engineering methodology (utilizing Claude Code, Gemini, and Codex alongside Spec-Driven Development) to accelerate feature delivery, complex API integrations, and refactoring without sacrificing architecture or code quality. Implemented automated pipelines for real-time trend detection, dynamic content generation, and multi-channel publishing, reducing operational production time by over 80%. Built with Clean Architecture, strict TypeScript typing, and containerized Docker environments.',
        },
        {
          name: 'CI/CD Pipelines & Docker Infrastructure',
          description:
            'Architected and operated automated CI/CD workflows using GitHub Actions across the monorepo microservices. Configured matrix validation (lint, type-checking, unit/integration testing) and multi-stage Docker container builds published to GitHub Container Registry (GHCR) with BuildKit layer caching, guaranteeing environment parity across local development and staging environments.',
        },
      ],
    },
  ],
};

export const BASE_LEONARDO_CV_ES: BaseCvData = {
  ...BASE_LEONARDO_CV_EN,
  profile: {
    ...BASE_LEONARDO_CV_EN.profile,
    role: 'DESARROLLADOR FULL STACK',
  },
  summary: {
    text: 'Desarrollador Full Stack con más de 10 años de experiencia construyendo aplicaciones web escalables, herramientas internas y plataformas SaaS multi-tenant. Pionero en la adopción de flujos de desarrollo aumentado por IA (trabajando diariamente con Gemini, Claude Code y Codex) junto con Desarrollo Basado en Especificaciones (SDD) para diseñar, construir y mantener sistemas listos para producción con alta velocidad y rigor arquitectónico. Especializado en Node.js/NestJS, TypeScript, Vue/React y PostgreSQL/MongoDB, con conocimientos prácticos en AWS core (S3, Lambda, IAM).',
  },
  skills_technical: [
    {
      category: 'IA & Ingeniería Moderna',
      items: [
        'Agentes de Código IA (Claude Code, Gemini, Codex)',
        'Desarrollo Basado en Especificaciones (SDD)',
        'Prompt Engineering & Agentes IA',
        'Orquestación de Flujos',
        'Prototipado Rápido & Entrega Autónoma',
      ],
    },
    {
      category: 'Desarrollo Backend',
      items: [
        'NestJS, Node.js',
        'APIs REST',
        'SaaS Multi-Inquilino',
        'Auth & RBAC',
        'PostgreSQL, MongoDB',
        'Almacenamiento Cloud (AWS S3, Firebase)',
      ],
    },
    {
      category: 'Desarrollo Frontend',
      items: ['Vue, Nuxt', 'React, Next.js', 'TypeScript', 'Diseño Responsivo'],
    },
    {
      category: 'Herramientas, DevOps & Despliegue',
      items: [
        'CI/CD (Pipelines de GitHub Actions & Builds Matriciales)',
        'Docker (Multi-Stage Builds, GHCR)',
        'AWS (Servicios Core: S3, Lambda, IAM)',
        'Git & Quality Gates',
        'TDD & Pruebas Automatizadas (Jest, Playwright)',
      ],
    },
  ],
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
    const company = (input.companyName || '').trim() || 'empresa';

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
    "experience": ${JSON.stringify(baseData.experience)}
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
              <h2 class="section-title">Summary</h2>
              <p class="summary-text">${data.summary.text}</p>
            </section>

            <section class="cv-section">
              <h2 class="section-title">Technical Skills</h2>
              <div class="skills-grid">
                ${skillsHtml}
              </div>
            </section>

            <section class="cv-section">
              <h2 class="section-title">Experience</h2>
              ${experienceHtml}
            </section>
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
