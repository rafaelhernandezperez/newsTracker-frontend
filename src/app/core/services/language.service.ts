import { Injectable, computed, signal } from '@angular/core';
import {
  AppLanguage,
  LOCALES,
  TRANSLATIONS,
  TranslationKey,
  companySummary,
  sectorLabel,
} from '../i18n/translations';

export type { AppLanguage, TranslationKey };

const LANGUAGE_STORAGE_KEY = 'newsTracker.language';

/**
 * The single source of truth for the interface language.
 *
 * `language` is a signal, so everything that reads it — `t()` in a template, the
 * `lang` query parameter the news API is called with, the Intl formatters below —
 * re-evaluates the moment the user switches. Views must never branch on an
 * article's own language: what the reader chose here is what the whole app,
 * including AI headlines and summaries, is rendered in.
 */
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly language = signal<AppLanguage>(this.readInitialLanguage());

  /** BCP 47 locale for Intl date/number formatting. */
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
      // Storage may be unavailable (private mode, quota); the choice still
      // applies to this session.
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

  /** Sector display name; falls back to a generic "Markets" label. */
  sector(sector?: string | null): string {
    return sectorLabel(sector, this.language());
  }

  /**
   * The blurb shown for a company: the curated catalogue copy for the current
   * language, else its exchange line, else whatever the source provided.
   */
  companyBlurb(company: { symbol: string; summary?: string; exchange?: string }): string {
    const curated = companySummary(company.symbol, this.language());
    if (curated) {
      return curated;
    }

    if (company.exchange?.trim()) {
      return this.t('company.listedOn', { exchange: company.exchange.trim() });
    }

    return company.summary?.trim() ?? '';
  }

  /** Long date ("14 June 2026" / "14 de junio de 2026"). */
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

  /** Clock time ("14:05"). */
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

  /** Coarse age of an article ("6h ago" / "hace 6 h"). */
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
