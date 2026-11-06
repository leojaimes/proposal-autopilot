import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import {
  StudioSession,
  StudioPatchPayload,
  StudioAiPromptPayload,
  StudioAiResponse,
  StudioSnapshotResult,
  StudioSection,
  StudioNielsenFinding,
} from "../types/studio.types";

export interface IStudioApiClient {
  setBaseUrl?(url: string): void;
  loadSession(idOrSlug: string): Observable<StudioSession>;
  applyPatch(
    idOrSlug: string,
    payload: StudioPatchPayload,
  ): Observable<{
    success: boolean;
    revisionNumber: number;
    sections: StudioSection[];
    publicUrl?: string;
  }>;
  generateAiProposal(
    idOrSlug: string,
    payload: StudioAiPromptPayload,
  ): Observable<StudioAiResponse>;
  publishSnapshot(idOrSlug: string): Observable<StudioSnapshotResult>;
  revertToRevision(
    idOrSlug: string,
    targetRevisionNumber: number,
  ): Observable<{
    success: boolean;
    revertedTo: number;
    newRevisionNumber: number;
    sections: StudioSection[];
  }>;
  autoFixNielsen(
    idOrSlug: string,
    finding: StudioNielsenFinding,
  ): Observable<{
    success: boolean;
    revisionNumber: number;
    description: string;
    appliedPatches: unknown[];
    publicUrl?: string;
  }>;
}

export const STUDIO_API_CLIENT = new InjectionToken<IStudioApiClient>(
  "STUDIO_API_CLIENT",
);

