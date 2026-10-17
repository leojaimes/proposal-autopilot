import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PipelineStateService } from '../../core/services/pipeline-state.service';

@Component({
  selector: 'app-engine-settings-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './engine-settings-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineSettingsDrawerComponent {
  public readonly pipeline = inject(PipelineStateService);
  
  public readonly isOpen = input<boolean>(false);
  public readonly closeDrawer = output<void>();

  public readonly activeTab = signal<'POSITIONING' | 'WEIGHTS' | 'SCRAPING'>('POSITIONING');

  public close(): void {
    this.closeDrawer.emit();
  }
}
