import { Injectable, inject, signal, computed } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  STUDIO_API_CLIENT,
  IStudioApiClient,
} from "../ports/studio-api-client.port";
import {
  StudioSession,
  StudioSection,
  StudioSlot,
  StudioDeviceMode,
  StudioRevision,
  StudioAiResponse,
  StudioSnapshotResult,
  StudioColorPalette,
} from "../types/studio.types";

export const PRESET_COLOR_PALETTES: StudioColorPalette[] = [
  {
    id: "ocean-pro",
    name: "Ocean Pro (Azul Confianza)",
    primary: "#0284c7",
    secondary: "#0f172a",
    accent: "#38bdf8",
  },
  {
    id: "emerald-health",
    name: "Emerald Health (Salud & Bienestar)",
    primary: "#059669",
    secondary: "#064e3b",
    accent: "#34d399",
  },
  {
    id: "ruby-urgency",
    name: "Ruby Urgency (Restaurantes & Urgencias)",
    primary: "#dc2626",
    secondary: "#450a0a",
    accent: "#f87171",
  },
  {
    id: "amber-craft",
    name: "Amber Craft (Construcción & Servicios)",
    primary: "#d97706",
    secondary: "#451a03",
    accent: "#fbbf24",
  },
  {
    id: "violet-modern",
    name: "Violet Modern (Tech & Agencias)",
    primary: "#7c3aed",
    secondary: "#2e1065",
    accent: "#a78bfa",
  },
];

@Injectable()
export class StudioStateService {
  private readonly apiClient: IStudioApiClient = inject(STUDIO_API_CLIENT);

  // --- Reactive Signals ---
  readonly session = signal<StudioSession | null>(null);
  readonly sections = signal<StudioSection[]>([]);
  readonly selectedSectionId = signal<string | null>(null);
  readonly selectedSlot = signal<StudioSlot | null>(null);
  readonly selectedSlotRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  readonly deviceMode = signal<StudioDeviceMode>("desktop");
  readonly activeTab = signal<"blocks" | "theme" | "history">("blocks");
  readonly humanLockedFields = signal<string[]>([]);
  readonly revisions = signal<StudioRevision[]>([]);
  readonly currentRevisionNumber = signal<number>(1);
  readonly rawHtml = signal<string>("");

  // Loading States
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isAiThinking = signal<boolean>(false);
  readonly isPublishing = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // AI Micro-Proposal
  readonly pendingAiProposal = signal<StudioAiResponse | null>(null);

  // --- Computed Signals ---
  readonly selectedSection = computed(() =>
    this.sections().find((s) => s.id === this.selectedSectionId()),
  );

  readonly canUndo = computed(() => this.revisions().length > 1);

  readonly demoSlug = computed(() => this.session()?.demo?.slug || "");

  readonly previewUrl = computed(() => this.session()?.demo?.publicUrl || "");

  /**
   * Initializes or refreshes the studio session by loading sections from backend.
   */
  async loadSession(idOrSlug: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const sess = await firstValueFrom(this.apiClient.loadSession(idOrSlug));
      this.session.set(sess);
      this.sections.set(sess.sections);
      this.currentRevisionNumber.set(sess.currentRevisionNumber);
      this.revisions.set(sess.revisions);
      this.humanLockedFields.set(sess.humanLockedFields || []);
      this.rawHtml.set(sess.html);
      if (sess.sections.length > 0 && !this.selectedSectionId()) {
        this.selectedSectionId.set(sess.sections[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Error loading website studio session: ${msg}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reorders sections with instant optimistic preview and persists to backend.
   */
  async reorderSections(newOrderIds: string[]): Promise<void> {
    const slug = this.demoSlug();
    if (!slug) return;

    // Optimistic UI reorder
    const currentSections = this.sections();
    const sectionMap = new Map(currentSections.map((s) => [s.id, s]));
    const reordered: StudioSection[] = [];

    for (let i = 0; i < newOrderIds.length; i++) {
      const sec = sectionMap.get(newOrderIds[i]);
      if (sec) {
        reordered.push({ ...sec, order: i });
      }
    }
    this.sections.set(reordered);
    this.isSaving.set(true);

    try {
      const res = await firstValueFrom(
        this.apiClient.applyPatch(slug, {
          description: "Reordered section layout",
          sectionsOrder: newOrderIds,
          author: "HUMAN",
        }),
      );
      this.currentRevisionNumber.set(res.revisionNumber);
      this.sections.set(res.sections);
      await this.refreshRevisionHistory(slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Failed to save section order: ${msg}`);
      // Rollback to original
      this.sections.set(currentSections);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Updates an individual slot's text/html content and locks the field.
   */
  async updateSlotContent(
    sectionId: string,
    slotId: string,
    newContent: string,
  ): Promise<void> {
    const slug = this.demoSlug();
    if (!slug) return;

    // Optimistically update local slot
    this.sections.update((list) =>
      list.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          slots: sec.slots.map((sl) =>
            sl.slotId === slotId ? { ...sl, content: newContent } : sl,
          ),
        };
      }),
    );

    // Lock this field so AI copilot won't overwrite human changes
    const lockedPath = `${sectionId}/${slotId}`;
    if (!this.humanLockedFields().includes(lockedPath)) {
      this.humanLockedFields.update((paths) => [...paths, lockedPath]);
    }

    this.isSaving.set(true);
    try {
      const res = await firstValueFrom(
        this.apiClient.applyPatch(slug, {
          description: `Updated copy for ${slotId}`,
          targetSectionId: sectionId,
          targetSlotId: slotId,
          newSlotContent: newContent,
          humanLockedFields: this.humanLockedFields(),
          author: "HUMAN",
        }),
      );
      this.currentRevisionNumber.set(res.revisionNumber);
      this.sections.set(res.sections);
      await this.refreshRevisionHistory(slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Failed to update slot: ${msg}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Requests a contextual AI micro-patch from the backend (HITL mode).
   */
  async requestAiMicroPatch(prompt: string): Promise<void> {
    const slug = this.demoSlug();
    const slot = this.selectedSlot();
    const secId = slot ? slot.sectionId : this.selectedSectionId() || undefined;

    if (!slug || !prompt.trim()) return;

    this.isAiThinking.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.apiClient.generateAiProposal(slug, {
          prompt,
          targetSectionId: secId,
          targetSlotId: slot?.slotId,
          humanLockedFields: this.humanLockedFields(),
          applyImmediately: false,
        }),
      );
      this.pendingAiProposal.set(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`AI Copilot error: ${msg}`);
    } finally {
      this.isAiThinking.set(false);
    }
  }

  /**
   * Human approves and commits the AI micro-proposal to the live demo.
   */
  async approveAiProposal(): Promise<void> {
    const proposal = this.pendingAiProposal();
    const slug = this.demoSlug();
    if (!proposal || !slug) return;

    this.isSaving.set(true);
    try {
      const res = await firstValueFrom(
        this.apiClient.applyPatch(slug, {
          description: `AI Optimization: ${proposal.proposal.reasoning}`,
          targetSectionId: proposal.targetSectionId,
          targetSlotId: proposal.targetSlotId,
          newSlotContent: proposal.targetSlotId
            ? proposal.proposal.modifiedSnippet
            : undefined,
          newSectionHtml: !proposal.targetSlotId
            ? proposal.proposal.modifiedSnippet
            : undefined,
          humanLockedFields: this.humanLockedFields(),
          author: "AI",
        }),
      );

      this.currentRevisionNumber.set(res.revisionNumber);
      this.sections.set(res.sections);
      this.pendingAiProposal.set(null);
      await this.refreshRevisionHistory(slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Failed to apply AI proposal: ${msg}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Discards the pending AI proposal without applying.
   */
  rejectAiProposal(): void {
    this.pendingAiProposal.set(null);
  }

  /**
   * Reverts to a historical revision number from the ledger.
   */
  async revertToRevision(revNum: number): Promise<void> {
    const slug = this.demoSlug();
    if (!slug) return;

    this.isSaving.set(true);
    try {
      const res = await firstValueFrom(
        this.apiClient.revertToRevision(slug, revNum),
      );
      this.currentRevisionNumber.set(res.newRevisionNumber);
      this.sections.set(res.sections);
      await this.refreshRevisionHistory(slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Failed to revert revision: ${msg}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Triggers high-fidelity WebP 1200x630 capture on AWS Lambda and publishes to R2.
   */
  async publishFinalSnapshot(): Promise<StudioSnapshotResult> {
    const slug = this.demoSlug();
    if (!slug) throw new Error("No demo slug loaded.");

    this.isPublishing.set(true);
    try {
      const result = await firstValueFrom(this.apiClient.publishSnapshot(slug));
      if (this.session()) {
        const cur = this.session()!;
        this.session.set({
          ...cur,
          demo: {
            ...cur.demo,
            screenshotUrl: result.screenshotUrl,
          },
        });
      }
      return result;
    } finally {
      this.isPublishing.set(false);
    }
  }

  // --- UI Helpers ---

  selectSlot(
    slot: StudioSlot | null,
    rect?: { top: number; left: number; width: number; height: number } | null,
  ): void {
    this.selectedSlot.set(slot);
    this.selectedSlotRect.set(rect || null);
    if (slot) {
      this.selectedSectionId.set(slot.sectionId);
    }
  }

  selectSection(sectionId: string): void {
    this.selectedSectionId.set(sectionId);
    this.selectedSlot.set(null);
    this.selectedSlotRect.set(null);
  }

  setDeviceMode(mode: StudioDeviceMode): void {
    this.deviceMode.set(mode);
  }

  setActiveTab(tab: "blocks" | "theme" | "history"): void {
    this.activeTab.set(tab);
  }

  private async refreshRevisionHistory(slug: string): Promise<void> {
    try {
      const sess = await firstValueFrom(this.apiClient.loadSession(slug));
      this.revisions.set(sess.revisions);
      this.rawHtml.set(sess.html);
    } catch (err) {
      // Non-blocking history reload
    }
  }
}

