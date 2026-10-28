import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PipelineStateService,
  PublicationsCvDocument,
  BaseCvData,
  CvSkillCategory,
  CvExperienceItem,
  CvEducationItem,
  CvLanguageItem,
} from '../../core/services/pipeline-state.service';
import { I18nService } from '../../core/services/i18n.service';
import { I18nPipe } from '../../core/pipes/i18n.pipe';

import {
  LucideGlobe,
  LucideCheckCircle2,
  LucideShield,
  LucideTarget,
  LucideBriefcase,
  LucideCompass,
  LucideUpload,
  LucideFileText,
  LucideSave,
  LucideEye,
  LucideCode,
  LucideSparkles,
  LucidePlus,
  LucideTrash2,
  LucideAlertCircle,
} from '@lucide/angular';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    I18nPipe,
    LucideGlobe,
    LucideCheckCircle2,
    LucideShield,
    LucideTarget,
    LucideBriefcase,
    LucideCompass,
    LucideUpload,
    LucideFileText,
    LucideSave,
    LucideEye,
    LucideCode,
    LucideSparkles,
    LucidePlus,
    LucideTrash2,
    LucideAlertCircle,
  ],
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly i18n = inject(I18nService);

  public readonly saveSuccessMessage = signal<string>('');

  // CV Section UI State
  public readonly cvActiveTab = signal<'visual' | 'json'>('visual');
  public readonly cvLang = signal<'es' | 'en'>('es');
  public readonly cvJsonText = signal<string>('');
  public readonly selectedCvFile = signal<File | null>(null);
  public readonly selectedFileName = signal<string>('');
  public readonly isDragging = signal<boolean>(false);
  public readonly jsonError = signal<string>('');

  constructor() {
    // Keep raw JSON in sync whenever activeCv changes and we are not in JSON editing mode
    effect(() => {
      const cv = this.pipeline.activeCv();
      if (cv && this.cvActiveTab() !== 'json') {
        this.cvJsonText.set(JSON.stringify(cv, null, 2));
      }
    });
  }

  public setLanguagePreference(mode: 'auto' | 'es' | 'en'): void {
    if (mode === 'auto') {
      this.i18n.setAutoDetect();
    } else {
      this.i18n.setLanguage(mode);
    }
    this.saveSuccessMessage.set(this.i18n.t('profile.save_success'));
    setTimeout(() => this.saveSuccessMessage.set(''), 3000);
  }

  public getInitials(name?: string): string {
    if (!name) return 'PA';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // File Upload Handlers
  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
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

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.setFile(event.dataTransfer.files[0]);
    }
  }

  private setFile(file: File): void {
    this.selectedCvFile.set(file);
    this.selectedFileName.set(file.name);
  }

  public clearSelectedFile(): void {
    this.selectedCvFile.set(null);
    this.selectedFileName.set('');
  }

  public async uploadAndExtractCv(): Promise<void> {
    const file = this.selectedCvFile();
    if (!file) return;
    await this.pipeline.parseAndSaveCvFromPdf(file);
    this.clearSelectedFile();
  }

  // Tabs & Mode Switching
  public setCvTab(tab: 'visual' | 'json'): void {
    if (tab === 'json') {
      const cv = this.pipeline.activeCv();
      if (cv) {
        this.cvJsonText.set(JSON.stringify(cv, null, 2));
      }
    } else if (tab === 'visual') {
      try {
        const text = this.cvJsonText().trim();
        if (text) {
          const parsed = JSON.parse(text) as PublicationsCvDocument;
          if (!parsed.translations || !parsed.translations.es || !parsed.translations.en) {
            throw new Error('El JSON debe contener translations.es y translations.en');
          }
          this.pipeline.activeCv.set(parsed);
          this.jsonError.set('');
        }
      } catch (err: any) {
        this.jsonError.set(`JSON inválido: ${err.message}`);
        return;
      }
    }
    this.cvActiveTab.set(tab);
  }

  public setCvLang(lang: 'es' | 'en'): void {
    this.cvLang.set(lang);
  }

  public onJsonTextChange(value: string): void {
    this.cvJsonText.set(value);
    try {
      JSON.parse(value);
      this.jsonError.set('');
    } catch (err: any) {
      this.jsonError.set(`Error de sintaxis JSON: ${err.message}`);
    }
  }

  public formatJson(): void {
    try {
      const parsed = JSON.parse(this.cvJsonText());
      this.cvJsonText.set(JSON.stringify(parsed, null, 2));
      this.jsonError.set('');
    } catch (err: any) {
      this.jsonError.set(`No se puede formatear: ${err.message}`);
    }
  }

  // Save & Preview Actions
  public async saveCv(): Promise<void> {
    let documentToSave: PublicationsCvDocument | null = null;

    if (this.cvActiveTab() === 'json') {
      try {
        const parsed = JSON.parse(this.cvJsonText()) as PublicationsCvDocument;
        if (!parsed.translations?.es || !parsed.translations?.en) {
          throw new Error('El documento requiere las propiedades translations.es y translations.en');
        }
        documentToSave = parsed;
        this.jsonError.set('');
      } catch (err: any) {
        this.jsonError.set(`No se puede guardar: ${err.message}`);
        return;
      }
    } else {
      documentToSave = this.pipeline.activeCv();
    }

    if (documentToSave) {
      await this.pipeline.saveActiveProfileCv(documentToSave);
    }
  }

  public previewCvPdf(): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const currentData = cv.translations[this.cvLang()];
    if (currentData) {
      this.pipeline.previewCvPdf(currentData);
    }
  }

  // Visual Form Data Helpers
  public getActiveTranslation(): BaseCvData | null {
    const cv = this.pipeline.activeCv();
    if (!cv || !cv.translations) return null;
    const trans = cv.translations[this.cvLang()];
    if (!trans) return null;
    if (!trans.education) trans.education = [];
    if (!trans.languages) trans.languages = [];
    return trans;
  }

  public updateProfileField(field: string, value: string): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const translation = cv.translations[lang];
    if (!translation) return;

    (translation.profile as any)[field] = value;
    this.pipeline.activeCv.set({ ...cv });
  }

  public updateSummaryText(value: string): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const translation = cv.translations[lang];
    if (!translation) return;

    translation.summary.text = value;
    this.pipeline.activeCv.set({ ...cv });
  }

  public updateSkillCategoryName(index: number, name: string): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const list = cv.translations[lang]?.skills_technical;
    if (list && list[index]) {
      list[index].category = name;
      this.pipeline.activeCv.set({ ...cv });
    }
  }

  public updateSkillItems(index: number, rawCommaSeparated: string): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const list = cv.translations[lang]?.skills_technical;
    if (list && list[index]) {
      list[index].items = rawCommaSeparated.split(',').map(s => s.trim()).filter(Boolean);
      this.pipeline.activeCv.set({ ...cv });
    }
  }

  public addSkillCategory(): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    if (!cv.translations[lang]) return;
    cv.translations[lang].skills_technical.push({
      category: 'Nueva Categoría',
      items: ['Habilidad 1', 'Habilidad 2'],
    });
    this.pipeline.activeCv.set({ ...cv });
  }

  public removeSkillCategory(index: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    cv.translations[lang]?.skills_technical.splice(index, 1);
    this.pipeline.activeCv.set({ ...cv });
  }

  public addExperience(): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    if (!cv.translations[lang]) return;
    cv.translations[lang].experience.unshift({
      title: 'Puesto / Cargo',
      period: '01/2024 - Presente',
      company: 'Empresa',
      location: 'Remoto',
      description: 'Descripción de las responsabilidades principales e impacto.',
      projects: [],
    });
    this.pipeline.activeCv.set({ ...cv });
  }

  public removeExperience(index: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    cv.translations[lang]?.experience.splice(index, 1);
    this.pipeline.activeCv.set({ ...cv });
  }

  public addExperienceProject(expIndex: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const exp = cv.translations[lang]?.experience[expIndex];
    if (exp) {
      if (!exp.projects) exp.projects = [];
      exp.projects.push({
        name: 'Nombre del Proyecto',
        description: 'Detalle de impacto y tecnologías utilizadas.',
      });
      this.pipeline.activeCv.set({ ...cv });
    }
  }

  public removeExperienceProject(expIndex: number, projIndex: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    const exp = cv.translations[lang]?.experience[expIndex];
    if (exp && exp.projects) {
      exp.projects.splice(projIndex, 1);
      this.pipeline.activeCv.set({ ...cv });
    }
  }

  public addEducation(): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    if (!cv.translations[lang]) return;
    if (!cv.translations[lang].education) {
      cv.translations[lang].education = [];
    }
    cv.translations[lang].education!.push({
      degree: 'Grado / Especialidad',
      institution: 'Universidad / Instituto',
      location: 'Ubicación',
      year: '2024',
    });
    this.pipeline.activeCv.set({ ...cv });
  }

  public removeEducation(index: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    cv.translations[lang]?.education?.splice(index, 1);
    this.pipeline.activeCv.set({ ...cv });
  }

  public addLanguage(): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    if (!cv.translations[lang]) return;
    if (!cv.translations[lang].languages) {
      cv.translations[lang].languages = [];
    }
    cv.translations[lang].languages!.push({
      name: 'Idioma',
      level: 'Avanzado',
    });
    this.pipeline.activeCv.set({ ...cv });
  }

  public removeLanguage(index: number): void {
    const cv = this.pipeline.activeCv();
    if (!cv) return;
    const lang = this.cvLang();
    cv.translations[lang]?.languages?.splice(index, 1);
    this.pipeline.activeCv.set({ ...cv });
  }
}
