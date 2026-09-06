import { Injectable, computed, signal } from '@angular/core';
import {
  AppLanguage,
  LOCALES,
  TRANSLATIONS,
  TranslationKey,
  sectorLabel,
} from '../i18n/translations';

export type { AppLanguage, TranslationKey };

const LANGUAGE_STORAGE_KEY = 'newsTracker.language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly language = signal<AppLanguage>(this.readInitialLanguage());

  readonly locale = computed(() => LOCALES[this.language()]);

  setLanguage(language: AppLanguage): void {
    if (language === this.language()) {
      return;
    }

    this.language.set(language);
    document.documentElement.lang = language;

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  /** Translate `key`, substituting `{name}` placeholders from `params`. */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const template = TRANSLATIONS[this.language()][key];

    if (!params) {
      return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
  }

  sector(sector?: string | null): string {
    return sectorLabel(sector, this.language());
  }

  formatLongDate(value?: string | Date | null): string {
    const date = this.toDate(value);

    if (!date) {
      return this.t('news.latestUpdate');
    }

    return new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  formatTime(value?: string | Date | null): string {
    const date = this.toDate(value);

    if (!date) {
      return '';
    }

    return new Intl.DateTimeFormat(this.locale(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatRelativeAge(value?: string | Date | null): string {
    const date = this.toDate(value);

    if (!date) {
      return this.t('time.latest');
    }

    const diffHours = Math.max(1, Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60)));

    if (diffHours < 24) {
      return this.t('time.hoursAgo', { count: diffHours });
    }

    return this.t('time.daysAgo', { count: Math.round(diffHours / 24) });
  }

  private toDate(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private readInitialLanguage(): AppLanguage {
    const stored = this.readStoredLanguage();
    if (stored) {
      document.documentElement.lang = stored;
      return stored;
    }

    const detected: AppLanguage = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    document.documentElement.lang = detected;
    return detected;
  }

  private readStoredLanguage(): AppLanguage | null {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return stored === 'en' || stored === 'es' ? stored : null;
    } catch {
      return null;
    }
  }
}
