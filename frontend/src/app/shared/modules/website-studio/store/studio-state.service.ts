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
  StudioViewMode,
  StudioSystemPersona,
  StudioAstroFile,
} from "../types/studio.types";

import {
  buildZipArchive,
  triggerDownload,
} from "../utils/export-astro-zip.util";

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
  readonly viewMode = signal<StudioViewMode>("preview");
  readonly activeTab = signal<"blocks" | "files" | "theme" | "history">("blocks");
  readonly systemPersona = signal<StudioSystemPersona>("high-conversion");
  readonly telemetry = signal<{ tokensInput: number; tokensOutput: number; latencyMs: number }>({
    tokensInput: 1420,
    tokensOutput: 310,
    latencyMs: 680,
  });
  readonly selectedAstroFilePath = signal<string>("src/pages/index.astro");
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
   * Virtual Astro 5 Component Projection.
   * Maps live studio sections to standard Astro components (src/components/*.astro)
   * and layouts (src/pages/index.astro, src/layouts/Layout.astro).
   */
  readonly astroFiles = computed<StudioAstroFile[]>(() => {
    const secs = this.sections();
    const demo = this.session()?.demo;
    const businessName = demo?.businessName || "Landing Page";

    const toPascal = (name: string) => {
      return name
        .toLowerCase()
        .replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
    };

    const files: StudioAstroFile[] = [];

    // 1. src/pages/index.astro
    const imports = secs
      .map((s) => `import ${toPascal(s.name)} from '../components/${toPascal(s.name)}.astro';`)
      .join("\n");
    const tags = secs.map((s) => `    <${toPascal(s.name)} />`).join("\n");

    const indexContent = `---
// src/pages/index.astro
// Universal Website Studio - Astro 5 Component Tree
import Layout from '../layouts/Layout.astro';
${imports}
---

<Layout title="${businessName}">
  <main class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
${tags}
  </main>
</Layout>
`;
    files.push({
      path: "src/pages/index.astro",
      name: "index.astro",
      language: "astro",
      content: indexContent,
      isComponent: false,
    });

    // 2. Component for each section
    for (const sec of secs) {
      const compName = toPascal(sec.name);
      const compContent = `---
// src/components/${compName}.astro
// Component for section: ${sec.name} (Order: ${sec.order})
interface Props {
  className?: string;
}
const { className = "" } = Astro.props;
---

<div class={className}>
  ${sec.rawHtml.trim()}
</div>
`;
      files.push({
        path: `src/components/${compName}.astro`,
        name: `${compName}.astro`,
        language: "astro",
        content: compContent,
        isComponent: true,
      });
    }

    // 3. src/layouts/Layout.astro
    files.push({
      path: "src/layouts/Layout.astro",
      name: "Layout.astro",
      language: "astro",
      content: `---
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<!doctype html>
<html lang="es" class="scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
    <slot />
  </body>
</html>
`,
      isComponent: false,
    });

    // 4. astro.config.mjs
    files.push({
      path: "astro.config.mjs",
      name: "astro.config.mjs",
      language: "javascript",
      content: `// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
});
`,
      isComponent: false,
    });

    // 5. package.json
    files.push({
      path: "package.json",
      name: "package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: demo?.slug || "website-demo",
          type: "module",
          version: "0.0.1",
          scripts: {
            dev: "astro dev",
            start: "astro dev",
            build: "astro check && astro build",
            preview: "astro preview",
          },
          dependencies: {
            astro: "^5.0.0",
            "@astrojs/tailwind": "^5.1.0",
            tailwindcss: "^3.4.0",
          },
        },
        null,
        2,
      ),
      isComponent: false,
    });

    return files;
  });

  readonly selectedAstroFile = computed<StudioAstroFile | null>(() => {
    const path = this.selectedAstroFilePath();
    return this.astroFiles().find((f) => f.path === path) || this.astroFiles()[0] || null;
  });

  setViewMode(mode: StudioViewMode): void {
    this.viewMode.set(mode);
  }

  setSystemPersona(persona: StudioSystemPersona): void {
    this.systemPersona.set(persona);
  }

  selectAstroFile(path: string): void {
    this.selectedAstroFilePath.set(path);
    this.viewMode.set("code");
  }

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

  setActiveTab(tab: "blocks" | "files" | "theme" | "history"): void {
    this.activeTab.set(tab);
  }

  /**
   * Generates and triggers instant browser download of the complete Astro 5 project .zip.
   */
  exportAstroProject(): void {
    const files = this.astroFiles();
    const slug = this.demoSlug() || "website-astro-demo";

    const entries = files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    // Add README.md
    entries.push({
      path: "README.md",
      content: `# ${this.session()?.demo?.businessName || slug} - Astro 5 Project

Generated by Universal Website Studio (Google AI Studio Workbench).

## Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Run local Astro development server
npm run dev

# 3. Build for production (Static / Cloudflare Pages / Vercel)
npm run build
\`\`\`

## Architecture
- \`src/pages/index.astro\`: Main landing page composed of isolated Astro components.
- \`src/components/*.astro\`: Independent, modular section components with Tailwind CSS.
- \`src/layouts/Layout.astro\`: Responsive semantic layout wrapper.
`,
    });

    const blob = buildZipArchive(entries);
    triggerDownload(blob, `${slug}-astro-project.zip`);
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

