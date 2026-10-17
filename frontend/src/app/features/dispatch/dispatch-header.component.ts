import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { ReportService } from '../../core/services/report.service';

export type AppViewMode = 'TERMINAL' | 'EXPLORER';

@Component({
  selector: 'app-dispatch-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispatch-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchHeaderComponent {
  public readonly theme = inject(ThemeService);
  public readonly report = inject(ReportService);

  public readonly activeView = input<AppViewMode>('TERMINAL');
  public readonly viewModeChange = output<AppViewMode>();
  public readonly openSettings = output<void>();
}
