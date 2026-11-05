import {
  Component,
  inject,
  output,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { StudioStateService } from "../../store/studio-state.service";
import { StudioDeviceMode, StudioViewMode } from "../../types/studio.types";

@Component({
  selector: "app-studio-toolbar",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./studio-toolbar.component.html",
})
export class StudioToolbarComponent {
  readonly state = inject(StudioStateService);
  readonly close = output<void>();
  readonly published = output<string>();

  setDevice(mode: StudioDeviceMode): void {
    this.state.setDeviceMode(mode);
  }

  setViewMode(mode: StudioViewMode): void {
    this.state.setViewMode(mode);
  }

  onExportAstro(): void {
    this.state.exportAstroProject();
  }

  async onPublish(): Promise<void> {
    try {
      const res = await this.state.publishFinalSnapshot();
      this.published.emit(res.screenshotUrl);
    } catch (err) {
      // Error handled by state.error
    }
  }
}

