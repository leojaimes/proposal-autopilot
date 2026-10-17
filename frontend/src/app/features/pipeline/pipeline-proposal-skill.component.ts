import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pipeline-proposal-skill',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Proposal Skill: Doc + Diagram + Letter</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          The 3-tier deliverable that converts cold clients into booked discovery calls.
        </p>
      </div>

      <!-- 35-Word Formula Box -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-content-primary uppercase tracking-wider">The 35-Word Cover Letter Formula</span>
          <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Strict 35-Word Constraint</span>
        </div>
        <div class="p-4 rounded-lg bg-surface-elevated font-mono text-xs text-content-primary leading-relaxed border border-border-subtle">
          "Hi [Contact Name], I [Result from Proof Story]. I audited your [Specific Problem] and mapped your execution roadmap. Walkthrough: [LINK]"
        </div>
      </div>

      <!-- Architecture Diagram Preview -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <span class="text-xs font-semibold text-content-primary uppercase tracking-wider">Mermaid.js Execution Roadmap (Embedded in Walkthrough)</span>
        <div class="p-4 rounded-lg bg-surface-elevated font-mono text-xs text-indigo-300 leading-relaxed border border-border-subtle overflow-x-auto">
          flowchart TD<br/>
          &nbsp;&nbsp;A[Audit de Requerimientos] --&gt; B[Figma Tokens & Jerarquía Semántica]<br/>
          &nbsp;&nbsp;B --&gt; C[Librería de Componentes Autolayout]<br/>
          &nbsp;&nbsp;C --&gt; D[Handoff Limpio a Desarrolladores]
        </div>
      </div>
    </div>
  `
})
export class PipelineProposalSkillComponent {}
