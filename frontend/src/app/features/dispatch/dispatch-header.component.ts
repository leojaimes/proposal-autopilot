import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  ],
  templateUrl: './dispatch-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchHeaderComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);

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
  public readonly newPersonName = signal<string>('');
  public readonly newPersonRole = signal<string>('');

  public switchView(mode: AppViewMode): void {
    this.viewModeChange.emit(mode);
  }

  public toggleProfileDropdown(): void {
    this.isProfileDropdownOpen.update(v => !v);
  }

  public selectProfile(id: string): void {
    this.pipeline.selectProfile(id);
    this.isProfileDropdownOpen.set(false);
    this.openSettings.emit(); // Open settings drawer to see/calibrate the selected profile
  }

  public openCreateModal(): void {
    this.isProfileDropdownOpen.set(false);
    this.newPersonName.set('');
    this.newPersonRole.set('');
    this.isCreateProfileModalOpen.set(true);
  }

  public confirmCreateProfile(): void {
    const name = this.newPersonName().trim();
    const role = this.newPersonRole().trim() || 'Consultor / Especialista';
    if (!name) return;

    this.pipeline.createBlankProfile(name, role);
    this.isCreateProfileModalOpen.set(false);
    this.openSettings.emit(); // Open calibration drawer immediately so user can fill in their details
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
