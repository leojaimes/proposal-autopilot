import {
  Component,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { StudioStateService } from "../../store/studio-state.service";
import { StudioSystemPersona } from "../../types/studio.types";

@Component({
  selector: "app-studio-inference-panel",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./studio-inference-panel.component.html",
})
export class StudioInferencePanelComponent {
  readonly state = inject(StudioStateService);

  readonly personas: { id: StudioSystemPersona; label: string; desc: string; icon: string }[] = [
    {
      id: "high-conversion",
      label: "Alta Conversión",
      desc: "Respuesta directa, escasez, micro-garantías y llamadas a la acción irresistibles.",
      icon: "🎯",
    },
    {
      id: "medical-empathy",
      label: "Empatía & Salud",
      desc: "Tono cálido, confianza médica, acreditaciones y testimonios humanos.",
      icon: "🩺",
    },
    {
      id: "urgency",
      label: "Urgencia Inmediata",
      desc: "Servicios 24/7, atención en menos de 30 minutos y llamadas directas.",
      icon: "⚡",
    },
    {
      id: "minimalist",
      label: "Minimalismo Premium",
      desc: "Estilo sofisticado, tipografía limpia y estética editorial moderna.",
      icon: "✨",
    },
  ];

  onSelectPersona(persona: StudioSystemPersona): void {
    this.state.setSystemPersona(persona);
  }

  onRevert(revNum: number): void {
    this.state.revertToRevision(revNum);
  }
}

