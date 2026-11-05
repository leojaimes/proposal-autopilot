import { Injectable, inject, InjectionToken } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { IStudioApiClient } from "../ports/studio-api-client.port";
import {
  StudioSession,
  StudioPatchPayload,
  StudioAiPromptPayload,
  StudioAiResponse,
  StudioSnapshotResult,
  StudioSection,
} from "../types/studio.types";

export const STUDIO_API_BASE_URL = new InjectionToken<string>(
  "STUDIO_API_BASE_URL",
  {
    providedIn: "root",
    factory: () => {
      // Configurable via global window, environment, or default to publications factory endpoint
      if (typeof window !== "undefined" && (window as any).__STUDIO_API_URL__) {
        return (window as any).__STUDIO_API_URL__;
      }
      return "http://localhost:3007/api/v1/factory/demos";
    },
  },
);

@Injectable({
  providedIn: "root",
})
export class HttpStudioApiAdapter implements IStudioApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(STUDIO_API_BASE_URL);

  loadSession(idOrSlug: string): Observable<StudioSession> {
    return this.http.get<StudioSession>(`${this.baseUrl}/${idOrSlug}/studio`);
  }

  applyPatch(
    idOrSlug: string,
    payload: StudioPatchPayload,
  ): Observable<{
    success: boolean;
    revisionNumber: number;
    sections: StudioSection[];
    publicUrl?: string;
  }> {
    return this.http.patch<{
      success: boolean;
      revisionNumber: number;
      sections: StudioSection[];
      publicUrl?: string;
    }>(`${this.baseUrl}/${idOrSlug}/patch`, payload);
  }

  generateAiProposal(
    idOrSlug: string,
    payload: StudioAiPromptPayload,
  ): Observable<StudioAiResponse> {
    return this.http.post<StudioAiResponse>(
      `${this.baseUrl}/${idOrSlug}/ai-patch`,
      payload,
    );
  }

  publishSnapshot(idOrSlug: string): Observable<StudioSnapshotResult> {
    return this.http.post<StudioSnapshotResult>(
      `${this.baseUrl}/${idOrSlug}/publish-snapshot`,
      {},
    );
  }

  revertToRevision(
    idOrSlug: string,
    targetRevisionNumber: number,
  ): Observable<{
    success: boolean;
    revertedTo: number;
    newRevisionNumber: number;
    sections: StudioSection[];
  }> {
    return this.http.post<{
      success: boolean;
      revertedTo: number;
      newRevisionNumber: number;
      sections: StudioSection[];
    }>(`${this.baseUrl}/${idOrSlug}/revert`, {
      targetRevisionNumber,
    });
  }
}

