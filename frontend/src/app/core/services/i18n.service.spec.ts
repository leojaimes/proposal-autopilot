import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [I18nService]
    });
  });

  it('should auto-detect browser language when no saved preference exists', () => {
    service = TestBed.inject(I18nService);
    expect(service.currentLang()).toBeDefined();
    expect(['es', 'en']).toContain(service.currentLang());
    expect(service.languageMode()).toBe('auto');
  });

  it('should switch to manual language and persist preference', () => {
    service = TestBed.inject(I18nService);
    service.setLanguage('en');
    expect(service.currentLang()).toBe('en');
    expect(service.languageMode()).toBe('manual');
    expect(localStorage.getItem('pa_selected_lang')).toBe('en');
    expect(service.t('nav.terminal')).toBe('Dispatch Terminal');

    service.setLanguage('es');
    expect(service.currentLang()).toBe('es');
    expect(service.t('nav.terminal')).toBe('Cabina de Despacho');
  });

  it('should reset to auto-detect mode', () => {
    service = TestBed.inject(I18nService);
    service.setLanguage('en');
    service.setAutoDetect();
    expect(service.languageMode()).toBe('auto');
    expect(localStorage.getItem('pa_lang_mode')).toBe('auto');
  });

  it('should fallback to key when translation is missing', () => {
    service = TestBed.inject(I18nService);
    expect(service.t('non.existent.key', 'Default Value')).toBe('Default Value');
    expect(service.t('non.existent.key')).toBe('non.existent.key');
  });
});
