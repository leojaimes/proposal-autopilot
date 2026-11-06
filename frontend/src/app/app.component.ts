import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { createCustomElement } from '@angular/elements';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppSidebarComponent } from './features/navigation/app-sidebar.component';
import {
  DispatchHeaderComponent,
  AppViewMode,
} from './features/dispatch/dispatch-header.component';
import { EngineSettingsDrawerComponent } from './features/dispatch/engine-settings-drawer.component';
import { LiveScrapeProgressComponent } from './features/dispatch/live-scrape-progress.component';
import { ReportService } from './core/services/report.service';
import { AuthService } from './core/services/auth.service';
import { RegisterCardComponent } from './features/auth/register-card.component';
import { WebsiteStudioModalComponent } from './shared/modules/website-studio';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RegisterCardComponent,
    AppSidebarComponent,
    DispatchHeaderComponent,
    EngineSettingsDrawerComponent,
    LiveScrapeProgressComponent,
    WebsiteStudioModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (directStudioSlug()) {
      <app-website-studio-modal
        [demoSlug]="directStudioSlug()!"
        (closed)="closeDirectStudio()"
      ></app-website-studio-modal>
    } @else if (!auth.isAuthenticated()) {
      <app-register-card></app-register-card>
    } @else {
      <div
        class="flex h-screen w-screen overflow-hidden bg-app text-content-primary"
      >
        <!-- Collapsible Rail Sidebar -->
        <app-sidebar
          [activeView]="currentView()"
          (viewModeChange)="navigateByViewMode($event)"
          (openSettings)="isSettingsOpen.set(true)"
        >
        </app-sidebar>

        <!-- Main Viewport (Header + Live Progress + Routed Content) -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          <!-- Top Bar with Streamlined Controls -->
          <app-dispatch-header
            [activeView]="currentView()"
            (viewModeChange)="navigateByViewMode($event)"
            (openSettings)="isSettingsOpen.set(true)"
          >
          </app-dispatch-header>

          <!-- Live SSE Scraping Activity Banner -->
          <app-live-scrape-progress></app-live-scrape-progress>

          <!-- Primary Routed Viewport -->
          <main class="flex-1 overflow-hidden flex relative w-full h-full">
            <router-outlet></router-outlet>
          </main>
        </div>

        <!-- Calibration Settings Drawer -->
        <app-engine-settings-drawer
          [isOpen]="isSettingsOpen()"
          (closeDrawer)="isSettingsOpen.set(false)"
        >
        </app-engine-settings-drawer>
      </div>
    }
  `,
})
export class AppComponent {
  public readonly auth = inject(AuthService);
  public readonly report = inject(ReportService);
  private readonly router = inject(Router);

  public readonly currentView = signal<AppViewMode>('TERMINAL');
  public readonly isSettingsOpen = signal<boolean>(false);
  public readonly directStudioSlug = signal<string | null>(null);
  private readonly injector = inject(Injector);

  constructor() {
    if (
      typeof window !== 'undefined' &&
      typeof customElements !== 'undefined' &&
      !customElements.get('studio-workbench')
    ) {
      try {
        const StudioWorkbenchElement = createCustomElement(
          WebsiteStudioModalComponent,
          {
            injector: this.injector,
          },
        );
        customElements.define('studio-workbench', StudioWorkbenchElement);
        console.info(
          '⚡ [StudioWorkbench] Registered <studio-workbench> Custom Element.',
        );
      } catch (e) {
        console.warn(
          'Could not register <studio-workbench> Custom Element:',
          e,
        );
      }
    }

    this.syncCurrentView(this.router.url);
    this.syncStudioParam();

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.syncCurrentView(event.urlAfterRedirects || event.url);
        this.syncStudioParam();
      });
  }

  public navigateByViewMode(mode: AppViewMode): void {
    switch (mode) {
      case 'TERMINAL':
        this.router.navigate(['/dispatch']);
        break;
      case 'EXPLORER':
        this.router.navigate(['/explorer']);
        break;
      case 'RADAR':
        this.router.navigate(['/radar/market']);
        break;
      case 'GEO_RADAR':
        this.router.navigate(['/radar/geo']);
        break;
      case 'WORKBENCH':
        this.router.navigate(['/workbench']);
        break;
      case 'PROFILE':
        this.router.navigate(['/profile']);
        break;
    }
  }

  private syncCurrentView(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (cleanUrl.startsWith('/radar/geo')) {
      this.currentView.set('GEO_RADAR');
    } else if (cleanUrl.startsWith('/radar/market')) {
      this.currentView.set('RADAR');
    } else if (cleanUrl.startsWith('/explorer')) {
      this.currentView.set('EXPLORER');
    } else if (cleanUrl.startsWith('/workbench')) {
      this.currentView.set('WORKBENCH');
    } else if (cleanUrl.startsWith('/profile')) {
      this.currentView.set('PROFILE');
    } else if (
      cleanUrl.startsWith('/dispatch') ||
      cleanUrl === '/' ||
      cleanUrl === ''
    ) {
      this.currentView.set('TERMINAL');
    }
  }

  private syncStudioParam(): void {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const studio = urlParams.get('studio');
    this.directStudioSlug.set(studio);
  }

  public closeDirectStudio(): void {
    this.directStudioSlug.set(null);
    this.router.navigate([], {
      queryParams: { studio: null },
      queryParamsHandling: 'merge',
    });
  }
}
