import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DispatchHeaderComponent } from './features/dispatch/dispatch-header.component';
import { DispatchTerminalComponent } from './features/dispatch/dispatch-terminal.component';
import { EngineSettingsDrawerComponent } from './features/dispatch/engine-settings-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DispatchHeaderComponent,
    DispatchTerminalComponent,
    EngineSettingsDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-app text-content-primary">
      <!-- Top Bar -->
      <app-dispatch-header (openSettings)="isSettingsOpen.set(true)"></app-dispatch-header>

      <!-- Central Dispatch Terminal (Split View) -->
      <app-dispatch-terminal></app-dispatch-terminal>

      <!-- Calibration Settings Drawer (Sliding from right) -->
      <app-engine-settings-drawer
        [isOpen]="isSettingsOpen()"
        (closeDrawer)="isSettingsOpen.set(false)">
      </app-engine-settings-drawer>
    </div>
  `
})
export class AppComponent {
  public readonly isSettingsOpen = signal<boolean>(false);
}
