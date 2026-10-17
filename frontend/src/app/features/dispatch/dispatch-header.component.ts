import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { ReportService } from '../../core/services/report.service';

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
  public readonly openSettings = output<void>();
}
