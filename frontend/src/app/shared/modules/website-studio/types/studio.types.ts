/**
 * Pure Domain Types for Universal Website Studio.
 * Zero external dependencies, zero coupling to CRM/Prospecting/Prisma.
 */

export type StudioDeviceMode = "desktop" | "mobile";

export type StudioViewMode = "preview" | "code";

export type StudioSystemPersona =
  | "high-conversion"
  | "medical-empathy"
  | "urgency"
  | "minimalist";

export interface StudioAstroFile {
  path: string;
  name: string;
  language: "astro" | "javascript" | "css" | "json";
  content: string;
  isComponent: boolean;
}

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
  extractedAssets?: StudioExtractedAsset[];
}

export type StudioAssetCategory =
  | "branding"
  | "hero"
  | "content"
  | "social-proof";

export interface StudioExtractedAsset {
  id: string;
  category: StudioAssetCategory;
  slotId: string;
  r2Path: string;
  publicUrl: string;
  width: number;
  height: number;
  byteSize: number;
  hash: string;
  originalUrl?: string;
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

