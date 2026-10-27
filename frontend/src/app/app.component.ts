import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DispatchHeaderComponent, AppViewMode } from './features/dispatch/dispatch-header.component';
import { DispatchTerminalComponent } from './features/dispatch/dispatch-terminal.component';
import { JobExplorerComponent } from './features/explorer/job-explorer.component';
import { EngineSettingsDrawerComponent } from './features/dispatch/engine-settings-drawer.component';
import { ZeroStateOnboardingComponent } from './features/onboarding/zero-state-onboarding.component';
import { LiveScrapeProgressComponent } from './features/dispatch/live-scrape-progress.component';
import { MarketRadarComponent } from './features/radar/market-radar.component';
import { UserProfileComponent } from './features/profile/user-profile.component';
import { ReportService } from './core/services/report.service';
import { AuthService } from './core/services/auth.service';
import { RegisterCardComponent } from './features/auth/register-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RegisterCardComponent,
    DispatchHeaderComponent,
    DispatchTerminalComponent,
    JobExplorerComponent,
    EngineSettingsDrawerComponent,
    ZeroStateOnboardingComponent,
    LiveScrapeProgressComponent,
    MarketRadarComponent,
    UserProfileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!auth.isAuthenticated()) {
      <app-register-card></app-register-card>
    } @else {
      <div class="flex flex-col h-screen w-screen overflow-hidden bg-app text-content-primary">
        <!-- Top Bar with View Switcher -->
        <app-dispatch-header
          [activeView]="currentView()"
          (viewModeChange)="currentView.set($event)"
          (openSettings)="isSettingsOpen.set(true)">
        </app-dispatch-header>

        <!-- Live SSE Scraping Activity Banner -->
        <app-live-scrape-progress></app-live-scrape-progress>

        <!-- Main Body: Conditional on Empty State vs Active Data -->
        <div class="flex-1 overflow-hidden flex">
          @if (currentView() === 'PROFILE') {
            <main class="flex-1 overflow-y-auto bg-app">
              <app-user-profile></app-user-profile>
            </main>
          } @else if (report.jobs().length === 0 && !report.isLoading() && !report.isScrapingInProgress()) {
            <!-- ZERO STATE / GREENFIELD ONBOARDING -->
            <main class="flex-1 overflow-y-auto bg-app">
              <app-zero-state-onboarding></app-zero-state-onboarding>
            </main>
          } @else {
            <!-- ACTIVE APPLICATION -->
            @if (currentView() === 'TERMINAL') {
              <app-dispatch-terminal class="flex-1 flex overflow-hidden"></app-dispatch-terminal>
            } @else if (currentView() === 'EXPLORER') {
              <main class="flex-1 overflow-y-auto bg-app">
                <app-job-explorer></app-job-explorer>
              </main>
            } @else if (currentView() === 'RADAR') {
              <main class="flex-1 overflow-y-auto bg-app">
                <app-market-radar></app-market-radar>
              </main>
            }
          }
        </div>

        <!-- Calibration Settings Drawer -->
        <app-engine-settings-drawer
          [isOpen]="isSettingsOpen()"
          (closeDrawer)="isSettingsOpen.set(false)">
        </app-engine-settings-drawer>
      </div>
    }
  `
})
export class AppComponent {
  public readonly auth = inject(AuthService);
  public readonly report = inject(ReportService);
  public readonly currentView = signal<AppViewMode>('TERMINAL');
  public readonly isSettingsOpen = signal<boolean>(false);
}
