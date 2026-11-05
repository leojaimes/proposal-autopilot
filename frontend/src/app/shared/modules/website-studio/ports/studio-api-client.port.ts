import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import {
  StudioSession,
  StudioPatchPayload,
  StudioAiPromptPayload,
  StudioAiResponse,
  StudioSnapshotResult,
  StudioSection,
} from "../types/studio.types";

export interface IStudioApiClient {
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
}

export const STUDIO_API_CLIENT = new InjectionToken<IStudioApiClient>(
  "STUDIO_API_CLIENT",
);

