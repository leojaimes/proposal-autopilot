import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';

import { 
  LucideRocket, 
  LucideRotateCcw, 
  LucideSparkles, 
  LucideFileText, 
  LucideUpload, 
  LucideCheck, 
  LucideShieldAlert, 
  LucideShieldCheck, 
  LucideArrowRight,
  LucideLayers
} from '@lucide/angular';

@Component({
  selector: 'app-zero-state-onboarding',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    LucideRocket, 
    LucideRotateCcw,
    LucideSparkles,
    LucideFileText,
    LucideUpload,
    LucideCheck,
    LucideShieldAlert,
    LucideShieldCheck,
    LucideArrowRight,
    LucideLayers
  ],
  templateUrl: './zero-state-onboarding.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZeroStateOnboardingComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);
  private readonly http = inject(HttpClient);

  public readonly rawCvText = signal<string>('');
  public readonly selectedFileName = signal<string>('');
  public readonly selectedFile = signal<File | null>(null);
  public readonly isDragging = signal<boolean>(false);
  public readonly isSynthesizing = signal<boolean>(false);
  public readonly synthesisResult = signal<any | null>(null);
  public readonly isActivating = signal<boolean>(false);
  public readonly activationStatus = signal<string>('');
  public readonly errorMessage = signal<string>('');
  public readonly isLoadingPreset = signal<boolean>(false);

  private getApiBase(): string {
    return (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? '/api'
      : 'http://localhost:7000/api';
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  public onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

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
      this.errorMessage.set('Formato no soportado. Por favor sube un archivo .pdf, .txt o .md');
      return;
    }

    this.errorMessage.set('');
    this.selectedFile.set(file);
    this.selectedFileName.set(file.name);

    // Si es texto plano o markdown, leerlo en memoria para que se vea en el textarea
    if (ext === '.txt' || ext === '.md') {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.rawCvText.set(e.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  }

  public clearFile(): void {
    this.selectedFile.set(null);
    this.selectedFileName.set('');
  }

  public loadExampleCv(): void {
    this.rawCvText.set(`Full Stack Developer with 10+ years of experience building scalable web and mobile applications. Specialized in Vue, Nuxt, Node.js, and MongoDB, with strong focus on AI-driven systems, automation, and spec-driven development. Currently building a multi-tenant SaaS platform that automates content generation, decision making, and publishing based on real-time events and trends.

TECHNICAL SKILLS
AI & Automation: AI Agent Design, Prompt Engineering, Gemini, OpenAI, LangChain / Tavily, Spec-Driven Dev (SDD), Workflow Orchestration
Backend Development: NestJS, Node.js, REST APIs, Multi-Tenant SaaS, Auth & RBAC, MongoDB, Firebase Storage
Frontend Development: Vue, Nuxt, React, Next.js, TypeScript, Responsive Design
Tools & Delivery: Git, Docker, Agile/Scrum, Jira, TDD, Unit & Integration Testing

EXPERIENCE
Spotlight Studio Mérida, Yucatán, México
AI Publications Platform (SaaS)
Designed and launched multi-tenant SaaS automating real-time event detection, decision making, and content generation using AI agents. Reduced content production time by 80%.

PepperTix
Scalable ticket resale platform with real-time secure transaction APIs built with Vue, Nuxt, Node.js, and MongoDB. Handled high-throughput peak ticket drop traffic.

Pepper Bot
Event search conversational chatbot integrating Messenger Graph API, Dialogflow, and ChatGPT with 17,000+ active users.

Pepper Videos
Flutter mobile application built with Clean Architecture for high testability and maintainability.`);
    this.clearFile();
    this.errorMessage.set('');
  }

  public synthesizeProfile(): void {
    const text = this.rawCvText().trim();
    const file = this.selectedFile();

    if (!text && !file) {
      this.errorMessage.set('Ingresa texto de tu CV o adjunta un archivo (.pdf, .txt, .md).');
      return;
    }

    this.errorMessage.set('');
    this.isSynthesizing.set(true);

    const apiBase = this.getApiBase();

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (text) {
        formData.append('rawText', text);
      }

      this.http.post<any>(`${apiBase}/config/synthesize-profile-from-cv`, formData)
        .subscribe({
          next: (res) => {
            this.isSynthesizing.set(false);
            if (res.success && res.data) {
              this.synthesisResult.set(res.data);
            }
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
            if (res.success && res.data) {
              this.synthesisResult.set(res.data);
            }
          },
          error: (err) => {
            this.isSynthesizing.set(false);
            this.errorMessage.set(err.error?.message || 'Error sintetizando perfil con IA.');
          }
        });
    }
  }

  public resetSynthesis(): void {
    this.synthesisResult.set(null);
    this.errorMessage.set('');
  }

  public activateAndEvaluate(): void {
    const data = this.synthesisResult();
    if (!data) return;

    this.isActivating.set(true);
    this.activationStatus.set('1/3 Sincronizando perfil y taxonomía en PostgreSQL...');

    const apiBase = this.getApiBase();

    const fullProfilePayload = {
      offerHeadline: data.offerHeadline,
      targetAudience: data.targetAudience,
      voiceRules: data.voiceRules,
      coreRoles: data.taxonomy.coreRoles,
      hybridRoles: data.taxonomy.hybridRoles,
      tangentialRoles: data.taxonomy.tangentialRoles,
      excludedRoles: data.taxonomy.excludedRoles,
      searchKeywords: data.scrapingConfig.searchKeywords,
      minHourlyRate: data.scrapingConfig.minHourlyRate,
      minBudgetFixed: data.scrapingConfig.minBudgetFixed,
      proofStories: data.proofStories.map((s: any) => ({
        keyCode: s.keyCode,
        companyOrProduct: s.companyOrProduct,
        impactMetric: s.impactMetric,
        domainTags: s.domainTags,
      })),
    };

    // 1. Guardar en PostgreSQL
    this.http.put(`${apiBase}/config/full-profile`, fullProfilePayload)
      .subscribe({
        next: () => {
          // Actualizar estado local en PipelineStateService
          this.pipeline.offerText.set(data.offerHeadline);
          this.pipeline.targetAudience.set(data.targetAudience);
          this.pipeline.coreRoles.set(data.taxonomy.coreRoles);
          this.pipeline.hybridRoles.set(data.taxonomy.hybridRoles);
          this.pipeline.tangentialRoles.set(data.taxonomy.tangentialRoles);
          this.pipeline.excludedRoles.set(data.taxonomy.excludedRoles);
          this.pipeline.keywordsText.set(data.scrapingConfig.searchKeywords.join(', '));
          this.pipeline.minHourlyRate.set(data.scrapingConfig.minHourlyRate);
          this.pipeline.minBudgetFixed.set(data.scrapingConfig.minBudgetFixed);
          this.pipeline.proofStories.set(data.proofStories.map((s: any) => ({
            id: s.keyCode,
            company: s.companyOrProduct,
            metric: s.impactMetric,
            detail: s.impactMetric,
            tags: s.domainTags || [],
          })));
          this.pipeline.syncActiveProfile();

          // 2. Re-evaluar en frío las 290 vacantes a costo $0 USD
          this.activationStatus.set('2/3 Re-evaluando 290 vacantes con tu nueva taxonomía ($0 tokens)...');
          this.http.post<{ success: boolean; message: string }>(`${apiBase}/scraping/reprocess`, {})
            .subscribe({
              next: () => {
                this.activationStatus.set('3/3 Cargando Cabina de Despacho con tu Top 3 Gold...');
                setTimeout(() => {
                  this.report.refresh();
                  this.isActivating.set(false);
                }, 1000);
              },
              error: () => {
                // Si falla reprocess, al menos refrescar la vista
                this.report.refresh();
                this.isActivating.set(false);
              }
            });
        },
        error: (err) => {
          this.isActivating.set(false);
          this.errorMessage.set(err.error?.message || 'Error guardando perfil en PostgreSQL.');
        }
      });
  }

  public restoreBoPreset(): void {
    this.isLoadingPreset.set(true);
    const apiBase = this.getApiBase();
    this.http.post(`${apiBase}/scraping/restore-preset`, {})
      .subscribe({
        next: () => {
          this.isLoadingPreset.set(false);
          this.report.refresh();
        },
        error: () => {
          this.isLoadingPreset.set(false);
          this.report.triggerLiveScrape(15);
        }
      });
  }
}
