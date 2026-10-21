import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';

import {
  LucideUser,
  LucidePlus,
  LucideZap,
  LucideSearch,
  LucideSettings,
  LucideChevronDown,
  LucideRefreshCw,
  LucideSparkles,
  LucideFileText,
  LucideUpload,
  LucideCheckCircle2,
  LucideAlertCircle,
  LucideShield,
  LucideTarget,
  LucideBriefcase,
  LucideX,
} from '@lucide/angular';

export type AppViewMode = 'TERMINAL' | 'EXPLORER';

@Component({
  selector: 'app-dispatch-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideUser,
    LucidePlus,
    LucideZap,
    LucideSearch,
    LucideSettings,
    LucideChevronDown,
    LucideRefreshCw,
    LucideSparkles,
    LucideFileText,
    LucideUpload,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideShield,
    LucideTarget,
    LucideBriefcase,
    LucideX,
  ],
  templateUrl: './dispatch-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchHeaderComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);
  private readonly http = inject(HttpClient);

  public readonly activeView = input.required<AppViewMode>();
  public readonly viewModeChange = output<AppViewMode>();
  public readonly openSettings = output<void>();

  public readonly highFitCount = computed(() => {
    return this.report.jobs().filter(j => j.fitLabel === 'High' || j.fitScore >= 70).length;
  });

  public readonly lowFitCount = computed(() => {
    return this.report.jobs().filter(j => j.fitLabel === 'Low' || j.fitScore < 50).length;
  });

  // Profile Switcher Dropdown & Modal State
  public readonly isProfileDropdownOpen = signal<boolean>(false);
  public readonly isCreateProfileModalOpen = signal<boolean>(false);
  public readonly modalTab = signal<'AI' | 'MANUAL'>('AI');
  public readonly newPersonName = signal<string>('');
  public readonly newPersonRole = signal<string>('');

  // AI CV Ingestion State
  public readonly rawCvText = signal<string>('');
  public readonly selectedFile = signal<File | null>(null);
  public readonly selectedFileName = signal<string>('');
  public readonly isSynthesizing = signal<boolean>(false);
  public readonly isActivating = signal<boolean>(false);
  public readonly synthesisResult = signal<any | null>(null);
  public readonly errorMessage = signal<string>('');

  private getApiBase(): string {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'http://localhost:7000/api' : '/api';
  }

  public switchView(mode: AppViewMode): void {
    this.viewModeChange.emit(mode);
  }

  public toggleProfileDropdown(): void {
    this.isProfileDropdownOpen.update(v => !v);
  }

  public selectProfile(id: string): void {
    this.pipeline.selectProfile(id);
    this.isProfileDropdownOpen.set(false);
    this.report.reprocessLeads().subscribe();
  }

  public openCreateModal(): void {
    this.isProfileDropdownOpen.set(false);
    this.modalTab.set('AI');
    this.newPersonName.set('');
    this.newPersonRole.set('');
    this.rawCvText.set('');
    this.selectedFile.set(null);
    this.selectedFileName.set('');
    this.synthesisResult.set(null);
    this.errorMessage.set('');
    this.isCreateProfileModalOpen.set(true);
  }

  public confirmCreateProfile(): void {
    const name = this.newPersonName().trim();
    const role = this.newPersonRole().trim() || 'Consultor / Especialista';
    if (!name) return;

    this.pipeline.createBlankProfile(name, role);
    this.isCreateProfileModalOpen.set(false);
    this.openSettings.emit();
  }

  public loadLeonardoCv(): void {
    this.rawCvText.set(`LEONARDO JAIMES ESTEVEZ
FULL STACK DEVELOPER
leo777jaimes@gmail.com | +52 9999000935 | LinkedIn: linkedIn

SUMMARY
Full Stack Developer with 10+ years of experience building scalable web and mobile applications. Specialized in Vue, Nuxt, Node.js, and MongoDB, with strong focus on AI-driven systems, automation, and spec-driven development. Currently building a multi-tenant SaaS platform that automates content generation, decision-making, and publishing based on real-time events and trends.

TECHNICAL SKILLS
AI & Automation: AI Agent Design, Prompt Engineering, Gemini, OpenAI, LangChain / Tavily, Spec-Driven Dev (SDD), Workflow Orchestration
Backend Development: NestJS, Node.js, REST APIs, Multi-Tenant SaaS, Auth & RBAC, MongoDB, Firebase Storage
Frontend Development: Vue, Nuxt, React, Next.js, TypeScript, Responsive Design
Tools & Delivery: Git, Docker, Agile/Scrum, Jira, TDD, Unit & Integration Testing

EXPERIENCE
Full Stack Developer 01/2020 - Present
Spotlight Studio Mérida, Yucatán, México
AI Publications Platform (SaaS)
Designed and led development of a multi-tenant SaaS platform that automates social media content creation and publishing for multiple clients from a single system. The platform detects real-world events and trends in real time, generates branded visual content automatically, and schedules posts across social networks without manual intervention. Reduced content production time by over 80% per campaign while maintaining brand consistency across all clients. Built with scalability, security, and maintainability as core principles — structured to grow with the business.

PepperTix Web Application
Led frontend development for PepperTix, a ticket resale web platform, utilizing Vue and Nuxt.js to deliver a responsive and scalable user experience. Improved SEO performance and platform accessibility, resulting in increased user engagement. Collaborated closely with UX and QA teams to ensure high-quality deliverables.

Pepper Tix Backend
Developed backend services to support PepperTix features using Node.js and Express.js. Designed and maintained RESTful APIs to handle ticket transactions, user management, and notifications. Ensured database integration and data consistency with MongoDB.

Pepper Videos Mobile
Developed the Pepper Videos mobile application using Flutter, enabling users to search for videos, follow artists, and receive notifications. Implemented Clean Architecture principles ensuring scalability, testability, and maintainability.

Pepper Bot
Built a conversational event search chatbot for Facebook Messenger using Graph API, Messenger, Dialogflow, and ChatGPT.`);
    this.selectedFile.set(null);
    this.selectedFileName.set('');
    this.errorMessage.set('');
  }

  public onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  public onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.txt', '.md'].includes(ext)) {
      this.errorMessage.set('Formato no soportado (.pdf, .txt o .md).');
      return;
    }
    this.errorMessage.set('');
    this.selectedFile.set(file);
    this.selectedFileName.set(file.name);

    if (ext === '.txt' || ext === '.md') {
      const reader = new FileReader();
      reader.onload = (e) => this.rawCvText.set(e.target?.result as string || '');
      reader.readAsText(file);
    }
  }

  public clearFile(): void {
    this.selectedFile.set(null);
    this.selectedFileName.set('');
  }

  public synthesizeProfile(): void {
    const text = this.rawCvText().trim();
    const file = this.selectedFile();

    if (!text && !file) {
      this.errorMessage.set('Ingresa texto o adjunta un archivo para sintetizar.');
      return;
    }

    this.errorMessage.set('');
    this.isSynthesizing.set(true);
    const apiBase = this.getApiBase();

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (text) formData.append('rawText', text);

      this.http.post<any>(`${apiBase}/config/synthesize-profile-from-cv`, formData)
        .subscribe({
          next: (res) => {
            this.isSynthesizing.set(false);
            if (res.success && res.data) this.synthesisResult.set(res.data);
          },
          error: (err) => {
            this.isSynthesizing.set(false);
            this.errorMessage.set(err.error?.message || 'Error sintetizando perfil con IA.');
          }
        });
    } else {
      this.http.post<any>(`${apiBase}/config/synthesize-profile-from-cv`, { rawText: text })
        .subscribe({
          next: (res) => {
            this.isSynthesizing.set(false);
            if (res.success && res.data) this.synthesisResult.set(res.data);
          },
          error: (err) => {
            this.isSynthesizing.set(false);
            this.errorMessage.set(err.error?.message || 'Error sintetizando perfil con IA.');
          }
        });
    }
  }

  public activateSynthesizedProfile(): void {
    const data = this.synthesisResult();
    if (!data) return;

    this.isActivating.set(true);
    const apiBase = this.getApiBase();

    // 1. Crear y seleccionar perfil en PipelineStateService
    this.pipeline.createFromSynthesis(data);

    // 2. Persistir en PostgreSQL backend
    const fullProfilePayload = {
      offerHeadline: data.offerHeadline,
      targetAudience: data.targetAudience,
      voiceRules: data.voiceRules,
      coreRoles: data.taxonomy?.coreRoles || [],
      hybridRoles: data.taxonomy?.hybridRoles || [],
      tangentialRoles: data.taxonomy?.tangentialRoles || [],
      excludedRoles: data.taxonomy?.excludedRoles || [],
      searchKeywords: data.scrapingConfig?.searchKeywords || [],
      minHourlyRate: data.scrapingConfig?.minHourlyRate || 50,
      minBudgetFixed: data.scrapingConfig?.minBudgetFixed || 1000,
      proofStories: (data.proofStories || []).map((s: any) => ({
        keyCode: s.keyCode,
        companyOrProduct: s.companyOrProduct,
        impactMetric: s.impactMetric,
        domainTags: s.domainTags,
      })),
    };

    this.http.put(`${apiBase}/config/full-profile`, fullProfilePayload)
      .subscribe({
        next: () => {
          // 3. Re-evaluar leads de inmediato ($0 USD, 0 tokens)
          this.report.reprocessLeads().subscribe({
            next: () => {
              this.isActivating.set(false);
              this.isCreateProfileModalOpen.set(false);
            },
            error: () => {
              this.isActivating.set(false);
              this.isCreateProfileModalOpen.set(false);
            }
          });
        },
        error: (err) => {
          this.isActivating.set(false);
          this.errorMessage.set(err.error?.message || 'Error guardando perfil en PostgreSQL.');
        }
      });
  }

  public deleteProfile(id: string, event: Event): void {
    event.stopPropagation();
    if (confirm('¿Eliminar este perfil de calibración?')) {
      this.pipeline.deleteProfile(id);
    }
  }

  public handleReprocess(): void {
    this.report.reprocessLeads().subscribe();
  }
}

