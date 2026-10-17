import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DispatchHeaderComponent, AppViewMode } from './features/dispatch/dispatch-header.component';
import { DispatchTerminalComponent } from './features/dispatch/dispatch-terminal.component';
import { JobExplorerComponent } from './features/explorer/job-explorer.component';
import { EngineSettingsDrawerComponent } from './features/dispatch/engine-settings-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DispatchHeaderComponent,
    DispatchTerminalComponent,
    JobExplorerComponent,
    EngineSettingsDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-app text-content-primary">
      <!-- Top Bar with View Switcher -->
      <app-dispatch-header
        [activeView]="currentView()"
        (viewModeChange)="currentView.set($event)"
        (openSettings)="isSettingsOpen.set(true)">
      </app-dispatch-header>

      <!-- Dynamic View: Terminal vs Full Search Explorer -->
      <div class="flex-1 overflow-hidden flex">
        @if (currentView() === 'TERMINAL') {
          <app-dispatch-terminal class="flex-1 flex overflow-hidden"></app-dispatch-terminal>
        } @else {
          <main class="flex-1 overflow-y-auto bg-app">
            <app-job-explorer></app-job-explorer>
          </main>
        }
      </div>

      <!-- Calibration Settings Drawer -->
      <app-engine-settings-drawer
        [isOpen]="isSettingsOpen()"
        (closeDrawer)="isSettingsOpen.set(false)">
      </app-engine-settings-drawer>
    </div>
  `
})
export class AppComponent {
  public readonly currentView = signal<AppViewMode>('EXPLORER'); // Default to Explorer as requested by user!
  public readonly isSettingsOpen = signal<boolean>(false);
}
