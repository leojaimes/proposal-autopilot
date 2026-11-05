/**
 * Pure Domain Types for Universal Website Studio.
 * Zero external dependencies, zero coupling to CRM/Prospecting/Prisma.
 */

export type StudioDeviceMode = "desktop" | "mobile";

export interface StudioSlot {
  slotId: string;
  sectionId: string;
  tag: string;
  content: string;
  attributes: Record<string, string>;
}

export interface StudioSection {
  id: string;
  name: string;
  order: number;
  rawHtml: string;
  innerHtml: string;
  startIndex: number;
  endIndex: number;
  slots: StudioSlot[];
}

export interface StudioRevision {
  revisionNumber: number;
  author: "HUMAN" | "AI";
  description: string;
  createdAt: Date | string;
  isCurrent: boolean;
}

export interface StudioDemoMeta {
  id: string;
  slug: string;
  businessName: string;
  vertical: string;
  brand?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    tagline?: string;
    logoUrl?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  publicUrl?: string;
  screenshotUrl?: string;
}

export interface StudioSession {
  demo: StudioDemoMeta;
  sections: StudioSection[];
  currentRevisionNumber: number;
  revisions: StudioRevision[];
  humanLockedFields: string[];
  html: string;
}

export interface StudioPatchPayload {
  description: string;
  targetSectionId?: string;
  targetSlotId?: string;
  newSlotContent?: string;
  newSectionHtml?: string;
  sectionsOrder?: string[];
  humanLockedFields?: string[];
  author?: "HUMAN" | "AI";
}

export interface StudioAiPromptPayload {
  prompt: string;
  targetSectionId?: string;
  targetSlotId?: string;
  humanLockedFields?: string[];
  applyImmediately?: boolean;
}

export interface StudioAiProposal {
  patch: unknown[];
  reasoning: string;
  modifiedSnippet: string;
}

export interface StudioAiResponse {
  proposal: StudioAiProposal;
  targetSectionId?: string;
  targetSlotId?: string;
  applied: boolean;
}

export interface StudioSnapshotResult {
  success: boolean;
  screenshotUrl: string;
  storagePath: string;
  publicUrl?: string;
}

export interface StudioColorPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface StudioTypography {
  id: string;
  name: string;
  fontFamily: string;
}

