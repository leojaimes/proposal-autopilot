import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  output,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { StudioStateService } from "./store/studio-state.service";
import { StudioBlocksPanelComponent } from "./components/studio-blocks-panel/studio-blocks-panel.component";
import { StudioAiPromptComponent } from "./components/studio-ai-prompt/studio-ai-prompt.component";
import { StudioToolbarComponent } from "./components/studio-toolbar/studio-toolbar.component";
import { GUEST_BRIDGE_SCRIPT } from "./bridge/studio-guest-bridge";
import { StudioSlot } from "./types/studio.types";

@Component({
  selector: "app-website-studio-modal",
  standalone: true,
  imports: [
    CommonModule,
    StudioBlocksPanelComponent,
    StudioAiPromptComponent,
    StudioToolbarComponent,
  ],
  providers: [StudioStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./website-studio-modal.component.html",
})
export class WebsiteStudioModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) demoSlug!: string;
  @ViewChild("studioFrame") studioFrame?: ElementRef<HTMLIFrameElement>;

  readonly closed = output<void>();
  readonly snapshotPublished = output<string>();

  readonly state = inject(StudioStateService);
  private readonly sanitizer = inject(DomSanitizer);

  private messageHandler?: (event: MessageEvent) => void;

  /**
   * Enriches the raw HTML with the guest bridge script for real-time inspection.
   */
  readonly enrichedHtml = computed<SafeHtml>(() => {
    const raw = this.state.rawHtml();
    if (!raw) return "";

    const injected = raw.includes("</body>")
      ? raw.replace("</body>", `<script>${GUEST_BRIDGE_SCRIPT}</script></body>`)
      : `${raw}<script>${GUEST_BRIDGE_SCRIPT}</script>`;

    return this.sanitizer.bypassSecurityTrustHtml(injected);
  });

  ngOnInit(): void {
    if (this.demoSlug) {
      this.state.loadSession(this.demoSlug);
    }

    this.messageHandler = (event: MessageEvent) => {
      this.handleBridgeMessage(event);
    };
    window.addEventListener("message", this.messageHandler);
  }

  ngOnDestroy(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
    }
  }

  onScrollToSection(sectionId: string): void {
    const frame = this.studioFrame?.nativeElement;
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        {
          type: "STUDIO_SCROLL_SECTION",
          payload: { sectionId },
        },
        "*",
      );
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onPublished(url: string): void {
    this.snapshotPublished.emit(url);
  }

  private handleBridgeMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === "STUDIO_SLOT_CLICKED") {
      const payload = data.payload;
      const slot: StudioSlot = {
        slotId: payload.slotId,
        sectionId: payload.sectionId,
        tag: payload.tag,
        content: payload.content,
        attributes: {},
      };
      this.state.selectSlot(slot, payload.rect);
    }
  }
}

