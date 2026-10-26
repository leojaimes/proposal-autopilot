import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { I18nService, SupportedLanguage } from '../../core/services/i18n.service';
import { I18nPipe } from '../../core/pipes/i18n.pipe';

import {
  LucideGlobe,
  LucideCheckCircle2,
  LucideShield,
  LucideTarget,
  LucideBriefcase,
  LucideCompass,
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
  ],
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly i18n = inject(I18nService);

  public readonly saveSuccessMessage = signal<string>('');

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
}
