import {
  Component,
  inject,
  output,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import {
  StudioStateService,
  PRESET_COLOR_PALETTES,
} from "../../store/studio-state.service";
import { StudioSection, StudioColorPalette } from "../../types/studio.types";

@Component({
  selector: "app-studio-blocks-panel",
  standalone: true,
  imports: [CommonModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./studio-blocks-panel.component.html",
})
export class StudioBlocksPanelComponent {
  readonly state = inject(StudioStateService);
  readonly scrollToSection = output<string>();

  readonly palettes = PRESET_COLOR_PALETTES;

  onDrop(event: CdkDragDrop<StudioSection[]>): void {
    const items = [...this.state.sections()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    const newOrderIds = items.map((s) => s.id);
    this.state.reorderSections(newOrderIds);
  }

  onSelectSection(sec: StudioSection): void {
    this.state.selectSection(sec.id);
    this.scrollToSection.emit(sec.id);
  }

  onSelectPalette(palette: StudioColorPalette): void {
    // In a live builder, we can update the theme attributes or prompt
    this.state.requestAiMicroPatch(
      `Aplica la paleta de colores "${palette.name}": Color primario ${palette.primary}, secundario ${palette.secondary}, acento ${palette.accent}`,
    );
  }

  onRevert(revNum: number): void {
    this.state.revertToRevision(revNum);
  }

  getSectionIcon(name: string): string {
    const n = name.toUpperCase();
    if (n.includes("HEADER") || n.includes("NAV")) return "🧭";
    if (n.includes("HERO")) return "⚡";
    if (n.includes("SERVICE")) return "🛠️";
    if (n.includes("WHY") || n.includes("TRUST")) return "⭐";
    if (n.includes("TESTIMONIAL") || n.includes("REVIEW")) return "💬";
    if (n.includes("FOOTER") || n.includes("CONTACT")) return "📍";
    return "📄";
  }
}

