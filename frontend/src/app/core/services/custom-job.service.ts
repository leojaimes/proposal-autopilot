import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CustomJobAnalysisResult {
  success: boolean;
  jobId: string;
  lang?: 'en' | 'es';
  title: string;
  companyName: string;
  location: string;
  description: string;
  requiredSkills: string[];
  fitScore: number;
  fitLabel: 'High' | 'Medium' | 'Low';
  strategicLane: string;
  drivers?: Array<{ title: string; description: string } | string>;
  drags?: Array<{ title: string; description: string } | string>;
  scoreNotes?: string;
  adaptedCv: any;
  coverLetter?: {
    recipient?: string;
    subject?: string;
    salutation?: string;
    valediction?: string;
    paragraphs?: string[];
  };
  technicalProposal?: string;
  mermaidCode?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomJobService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? '/api/scraping'
      : 'http://localhost:7000/api/scraping';

  analyzeJob(dto: { url?: string; rawText?: string; personaName?: string; lang?: 'en' | 'es' }): Observable<CustomJobAnalysisResult> {
    return this.http.post<CustomJobAnalysisResult>(`${this.baseUrl}/custom-job/analyze`, dto);
  }

  compilePdf(cvData: any, filename?: string): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/custom-job/compile-pdf`, { cvData, filename }, {
      responseType: 'blob',
    });
  }
}

