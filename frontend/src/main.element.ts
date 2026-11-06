import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideZoneChangeDetection } from '@angular/core';
import { WebsiteStudioModalComponent } from './app/shared/modules/website-studio/website-studio-modal.component';
import { STUDIO_API_CLIENT } from './app/shared/modules/website-studio/ports/studio-api-client.port';
import { HttpStudioApiAdapter } from './app/shared/modules/website-studio/adapters/http-studio-api.adapter';

export async function defineStudioWorkbenchElement() {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') {
    return;
  }

  if (customElements.get('studio-workbench')) {
    return;
  }

  try {
    const app = await createApplication({
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideHttpClient(withFetch()),
        {
          provide: STUDIO_API_CLIENT,
          useClass: HttpStudioApiAdapter,
        },
      ],
    });

    const StudioWorkbenchElement = createCustomElement(WebsiteStudioModalComponent, {
      injector: app.injector,
    });

    customElements.define('studio-workbench', StudioWorkbenchElement);
    console.info('⚡ [StudioWorkbench] Registered <studio-workbench> Autonomous Web Component.');
  } catch (err) {
    console.error('❌ [StudioWorkbench] Failed to register <studio-workbench>:', err);
  }
}

// Auto-register on import
if (typeof window !== 'undefined') {
  defineStudioWorkbenchElement();
}

