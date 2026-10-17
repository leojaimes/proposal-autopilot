import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pipeline-machine-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Machine Setup: Accounts & Keys</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          Configure API credentials, scraper actors, and synthesis model providers.
        </p>
      </div>

      <!-- Provider Status Grid -->
      <div class="grid grid-cols-3 gap-4">
        <!-- Apify Card -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-content-primary">Apify Scraper</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <p class="text-[11px] text-content-secondary leading-relaxed">
            Actor: <code class="text-brand-primary font-mono text-[10px]">flash_mage/upwork</code> ($3.00 / 1,000 results).
          </p>
          <div class="text-[10px] text-content-muted">Monthly free tier: $5.00 available</div>
        </div>

        <!-- LLM Synthesis Card -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-content-primary">Claude 3.5 Sonnet</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <p class="text-[11px] text-content-secondary leading-relaxed">
            Strict negative constraints: 0 em dashes, 35-word limit, peer-to-peer tone.
          </p>
          <div class="text-[10px] text-content-muted">Tokens per proposal: ~180 ($0.001)</div>
        </div>

        <!-- PostgreSQL 16 Card -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-content-primary">PostgreSQL 16</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <p class="text-[11px] text-content-secondary leading-relaxed">
            Port: <span class="font-mono text-content-primary font-bold">5438</span>. Multi-tenant schema with Prisma ORM.
          </p>
          <div class="text-[10px] text-emerald-400 font-medium">Database Healthy</div>
        </div>
      </div>

      <!-- Credentials Configuration -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-4">
        <div class="text-xs font-semibold text-content-primary uppercase tracking-wider">Environment Credentials (Stored in Docker)</div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-content-secondary mb-1">Apify API Token</label>
            <input type="password" value="apify_api_********************************" disabled
                   class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-2.5 text-xs text-content-muted font-mono">
          </div>
          <div>
            <label class="block text-xs text-content-secondary mb-1">Anthropic API Key</label>
            <input type="password" value="sk-ant-api03-********************************" disabled
                   class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-2.5 text-xs text-content-muted font-mono">
          </div>
        </div>
      </div>
    </div>
  `
})
export class PipelineMachineSetupComponent {}
