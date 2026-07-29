import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'newsTracker.language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly language = signal<AppLanguage>(this.readInitialLanguage());

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }

  private readInitialLanguage(): AppLanguage {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'es') {
      document.documentElement.lang = stored;
      return stored;
    }

    const detected: AppLanguage = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    document.documentElement.lang = detected;
    return detected;
  }
}
