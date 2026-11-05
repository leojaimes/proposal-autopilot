import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { StudioStateService } from "../../store/studio-state.service";

@Component({
  selector: "app-studio-ai-prompt",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./studio-ai-prompt.component.html",
})
export class StudioAiPromptComponent {
  readonly state = inject(StudioStateService);

  readonly userPrompt = signal<string>("");

  readonly quickChips = [
    { label: "🔥 Más Urgencia", prompt: "Haz el copy mucho más urgente y persuasivo, orientado a que llamen de inmediato." },
    { label: "⭐ Resaltar Garantía", prompt: "Agrega énfasis claro en garantía total, confianza y satisfacción del cliente." },
    { label: "💼 Más Formal & Pro", prompt: "Ajusta la redacción a un tono sobrio, elegante y corporativo de alta gama." },
    { label: "🎯 CTA Directo", prompt: "Reemplaza el llamado a la acción por uno más directo hacia WhatsApp o llamada inmediata." },
  ];

  onSubmit(): void {
    const text = this.userPrompt().trim();
    if (!text) return;
    this.state.requestAiMicroPatch(text);
    this.userPrompt.set("");
  }

  onSelectChip(chipPrompt: string): void {
    this.userPrompt.set(chipPrompt);
    this.onSubmit();
  }

  onApprove(): void {
    this.state.approveAiProposal();
  }

  onReject(): void {
    this.state.rejectAiProposal();
  }

  onClose(): void {
    this.state.selectSlot(null);
  }
}

