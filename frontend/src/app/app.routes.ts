import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dispatch',
  },
  {
    path: 'dispatch',
    loadComponent: () =>
      import('./features/dispatch/dispatch-terminal.component').then(
        (m) => m.DispatchTerminalComponent,
      ),
  },
  {
    path: 'explorer',
    loadComponent: () =>
      import('./features/explorer/job-explorer.component').then(
        (m) => m.JobExplorerComponent,
      ),
  },
  {
    path: 'workbench',
    loadComponent: () =>
      import('./features/workbench/custom-job-workbench.component').then(
        (m) => m.CustomJobWorkbenchComponent,
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/user-profile.component').then(
        (m) => m.UserProfileComponent,
      ),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/zero-state-onboarding.component').then(
        (m) => m.ZeroStateOnboardingComponent,
      ),
  },
  {
    path: 'radar',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'geo',
      },
      {
        path: 'market',
        loadComponent: () =>
          import('./features/radar/market-radar.component').then(
            (m) => m.MarketRadarComponent,
          ),
      },
      {
        path: 'geo',
        loadComponent: () =>
          import('./features/radar/geo-radar.component').then(
            (m) => m.GeoRadarComponent,
          ),
      },
      {
        path: 'geo/:countryCode/:stateSlug/:citySlug',
        loadComponent: () =>
          import('./features/radar/geo-radar.component').then(
            (m) => m.GeoRadarComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dispatch',
  },
];
