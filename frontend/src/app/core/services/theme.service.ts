import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<AppTheme>('dark');
  public readonly theme = this._theme.asReadonly();

  constructor() {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('proposal_theme') : 'dark') as AppTheme;
    const initialTheme: AppTheme = saved === 'light' ? 'light' : 'dark';
    this._theme.set(initialTheme);
    this.applyTheme(initialTheme);

    effect(() => {
      const current = this._theme();
      this.applyTheme(current);
      if (typeof window !== 'undefined') {
        localStorage.setItem('proposal_theme', current);
      }
    });
  }

  public toggleTheme(): void {
    this._theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  public setTheme(theme: AppTheme): void {
    this._theme.set(theme);
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
