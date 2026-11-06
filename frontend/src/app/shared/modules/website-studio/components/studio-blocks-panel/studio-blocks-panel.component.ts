import {
  Component,
  inject,
  output,
  signal,
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
import {
  StudioSection,
  StudioColorPalette,
  StudioAstroFile,
  StudioExtractedAsset,
  StudioNielsenFinding,
} from "../../types/studio.types";

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
  readonly copiedAssetId = signal<string | null>(null);

  copyAssetUrl(asset: StudioExtractedAsset): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(asset.publicUrl);
      this.copiedAssetId.set(asset.id);
      setTimeout(() => this.copiedAssetId.set(null), 2000);
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getCategoryBadge(category: string): { label: string; class: string } {
    switch (category) {
      case "branding":
        return {
          label: "Logo / Brand",
          class: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        };
      case "hero":
        return {
          label: "Hero / Banner",
          class: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        };
      case "content":
        return {
          label: "Servicios / Contenido",
          class: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "social-proof":
        return {
          label: "Testimonios / Equipo",
          class: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        };
      default:
        return {
          label: category,
          class: "bg-slate-500/20 text-slate-300 border-slate-500/30",
        };
    }
  }

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

  onSelectAstroFile(path: string): void {
    this.state.selectAstroFile(path);
  }

  onExportZip(): void {
    this.state.exportAstroProject();
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

  onApplyNielsenAutoFix(finding: StudioNielsenFinding, index: number): void {
    this.state.applyNielsenAutoFix(finding, index);
  }

  getNielsenScoreBadge(score: number): { text: string; bg: string; textClass: string } {
    if (score >= 80) {
      return { text: "Excelente", bg: "bg-emerald-500/20 border-emerald-500/40", textClass: "text-emerald-400" };
    }
    if (score >= 60) {
      return { text: "Aceptable", bg: "bg-amber-500/20 border-amber-500/40", textClass: "text-amber-400" };
    }
    return { text: "Crítico", bg: "bg-rose-500/20 border-rose-500/40", textClass: "text-rose-400" };
  }

  getFindingSeverityBadge(severity?: string): { label: string; class: string } {
    switch (severity) {
      case "CRITICAL":
        return { label: "Crítico", class: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
      case "HIGH":
        return { label: "Alto", class: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      case "MEDIUM":
        return { label: "Medio", class: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
      case "LOW":
        return { label: "Bajo", class: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      default:
        return { label: "Aviso", class: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
    }
  }
}

