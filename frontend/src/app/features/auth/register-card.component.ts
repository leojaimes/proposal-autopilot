import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import { LucideShieldCheck, LucideSparkles, LucideArrowRight, LucideAlertCircle, LucideLogIn, LucideUserPlus } from '@lucide/angular';

@Component({
  selector: 'app-register-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideShieldCheck,
    LucideSparkles,
    LucideArrowRight,
    LucideAlertCircle,
    LucideLogIn,
    LucideUserPlus,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen w-full flex items-center justify-center p-6 bg-app relative overflow-hidden">
      <!-- Background ambient glow -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-8 shadow-2xl relative z-10">
        <!-- Brand Header -->
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <svg lucideSparkles class="w-5 h-5 text-white"></svg>
          </div>
          <div>
            <h1 class="text-lg font-bold text-content-primary tracking-tight">Proposal Autopilot</h1>
            <p class="text-xs text-content-secondary">Autonomous Lead Ingestion & Proposal Cockpit</p>
          </div>
        </div>

        <!-- Mode Title & Subtitle -->
        <div class="mb-6">
          @if (mode() === 'LOGIN') {
            <h2 class="text-xl font-semibold text-content-primary">Iniciar Sesión</h2>
            <p class="text-xs text-content-secondary mt-1">
              Ingresa tus credenciales para acceder a la cabina de tu organización.
            </p>
          } @else {
            <h2 class="text-xl font-semibold text-content-primary">Crear cuenta de operador</h2>
            <p class="text-xs text-content-secondary mt-1">
              Registra tu organización para aislar tus leads, perfiles de posicionamiento y calibraciones.
            </p>
          }
        </div>

        <!-- Error Alert -->
        @if (errorMessage()) {
          <div class="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs animate-in fade-in duration-200">
            <svg lucideAlertCircle class="w-4 h-4 shrink-0 mt-0.5"></svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <!-- Company / Organization Name (Only on Register) -->
          @if (mode() === 'REGISTER') {
            <div class="animate-in fade-in slide-in-from-top-1 duration-150">
              <label class="block text-xs font-medium text-content-secondary mb-1.5">Nombre de la Organización</label>
              <input
                type="text"
                name="companyName"
                [(ngModel)]="companyName"
                placeholder="Ej. Acme Design Studio"
                required
                class="w-full px-3.5 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl text-sm text-content-primary placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          }

          <!-- Email -->
          <div>
            <label class="block text-xs font-medium text-content-secondary mb-1.5">Correo Corporativo</label>
            <input
              type="email"
              name="email"
              [(ngModel)]="email"
              placeholder="operador@acme.com"
              required
              class="w-full px-3.5 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl text-sm text-content-primary placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-xs font-medium text-content-secondary mb-1.5">Contraseña (Mínimo 8 caracteres)</label>
            <input
              type="password"
              name="password"
              [(ngModel)]="password"
              placeholder="••••••••"
              minlength="8"
              required
              class="w-full px-3.5 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl text-sm text-content-primary placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            [disabled]="isLoading() || !isFormValid()"
            class="w-full mt-2 py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer">
            @if (isLoading()) {
              <span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>{{ mode() === 'LOGIN' ? 'Autenticando...' : 'Aprovisionando tenant...' }}</span>
            } @else {
              <span>{{ mode() === 'LOGIN' ? 'Entrar a la Cabina' : 'Crear Organización y Acceder' }}</span>
              <svg lucideArrowRight class="w-4 h-4"></svg>
            }
          </button>
        </form>

        <!-- Toggle Login / Register Mode -->
        <div class="mt-5 text-center">
          @if (mode() === 'LOGIN') {
            <p class="text-xs text-content-secondary">
              ¿No tienes una organización registrada?
              <button
                type="button"
                (click)="toggleMode('REGISTER')"
                class="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors">
                Regístrate aquí
              </button>
            </p>
          } @else {
            <p class="text-xs text-content-secondary">
              ¿Ya tienes una cuenta registrada?
              <button
                type="button"
                (click)="toggleMode('LOGIN')"
                class="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors">
                Inicia sesión aquí
              </button>
            </p>
          }
        </div>

        <div class="mt-6 pt-5 border-t border-border-subtle flex items-center justify-center gap-2 text-xs text-zinc-500">
          <svg lucideShieldCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
          <span>Sesión encriptada con JWT y aislamiento estricto</span>
        </div>
      </div>
    </div>
  `,
})
export class RegisterCardComponent {
  private readonly auth = inject(AuthService);
  private readonly pipeline = inject(PipelineStateService);
  private readonly report = inject(ReportService);

  public readonly mode = signal<'LOGIN' | 'REGISTER'>('LOGIN');

  public companyName = '';
  public email = '';
  public password = '';

  public readonly isLoading = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  public toggleMode(target: 'LOGIN' | 'REGISTER'): void {
    this.mode.set(target);
    this.errorMessage.set(null);
  }

  public isFormValid(): boolean {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
    const isPasswordValid = this.password.length >= 8;

    if (this.mode() === 'REGISTER') {
      return this.companyName.trim().length > 1 && isEmailValid && isPasswordValid;
    }
    return isEmailValid && isPasswordValid;
  }

  public onSubmit(): void {
    if (!this.isFormValid() || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (this.mode() === 'REGISTER') {
      this.auth.register({
        companyName: this.companyName.trim(),
        email: this.email.trim(),
        password: this.password,
      }).subscribe({
        next: async () => {
          await this.pipeline.loadProfilesFromDatabase();
          this.report.refresh();
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          const msg = err?.error?.message || 'Error al procesar el registro. Intenta de nuevo.';
          this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
    } else {
      this.auth.login({
        email: this.email.trim(),
        password: this.password,
      }).subscribe({
        next: async () => {
          await this.pipeline.loadProfilesFromDatabase();
          this.report.refresh();
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          const msg = err?.error?.message || (err?.status === 401 ? 'Credenciales incorrectas. Verifica tu correo y contraseña.' : 'Error al iniciar sesión.');
          this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
    }
  }
}
