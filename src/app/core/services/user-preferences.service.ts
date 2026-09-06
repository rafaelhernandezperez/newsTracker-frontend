import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Company } from '../models/company.model';
import { COMPANIES } from '../data/companies.data';
import { AuthService } from './auth.service';

const LEGACY_COMPANIES_KEY = 'nt.companies';

const LEGACY_TICKERS_KEY = 'nt.tickers';

export type StoredCompany = Pick<Company, 'symbol' | 'name' | 'sector'>;

export type AlertPrefs = {
  priceMoves: boolean;
  highImpact: boolean;
  dailyDigest: boolean;
};

/** Keep defaults aligned with the backend alert preferences. */
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  priceMoves: true,
  highImpact: true,
  dailyDigest: true,
};

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly auth = inject(AuthService);

  private uid: string | null = this.auth.user()?.uid ?? null;

  readonly companies = signal<StoredCompany[]>(this.readCompanies());

  readonly tickers = computed(() => this.companies().map((company) => company.symbol));
  readonly alertPrefs = signal<AlertPrefs>(this.readAlertPrefs());

  constructor() {
    effect(() => {
      const uid = this.auth.user()?.uid ?? null;
      if (uid === this.uid) {
        return;
      }
      this.uid = uid;
      this.companies.set(this.readCompanies());
      this.alertPrefs.set(this.readAlertPrefs());
    });
  }

  setCompanies(companies: StoredCompany[]): void {
    const cleaned = this.cleanCompanies(companies);
    this.companies.set(cleaned);
    this.write(this.companiesKey, cleaned);
  }

  setAlertPrefs(prefs: AlertPrefs): void {
    const cleaned: AlertPrefs = {
      priceMoves: Boolean(prefs.priceMoves),
      highImpact: Boolean(prefs.highImpact),
      dailyDigest: Boolean(prefs.dailyDigest),
    };
    this.alertPrefs.set(cleaned);
    this.write(this.alertPrefsKey, cleaned);
  }

  private get companiesKey(): string {
    return this.uid ? `nt.${this.uid}.companies` : LEGACY_COMPANIES_KEY;
  }

  private get alertPrefsKey(): string {
    return this.uid ? `nt.${this.uid}.alertPrefs` : 'nt.alertPrefs';
  }

  private readAlertPrefs(): AlertPrefs {
    try {
      const raw = localStorage.getItem(this.alertPrefsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
        return {
          priceMoves:
            typeof parsed.priceMoves === 'boolean'
              ? parsed.priceMoves
              : DEFAULT_ALERT_PREFS.priceMoves,
          highImpact:
            typeof parsed.highImpact === 'boolean'
              ? parsed.highImpact
              : DEFAULT_ALERT_PREFS.highImpact,
          dailyDigest:
            typeof parsed.dailyDigest === 'boolean'
              ? parsed.dailyDigest
              : DEFAULT_ALERT_PREFS.dailyDigest,
        };
      }
    } catch {
      // Ignore unavailable or invalid stored preferences.
    }
    return { ...DEFAULT_ALERT_PREFS };
  }

  private cleanCompanies(companies: StoredCompany[]): StoredCompany[] {
    const bySymbol = new Map<string, StoredCompany>();
    for (const company of companies) {
      const symbol = company.symbol?.trim().toUpperCase();
      if (!symbol || bySymbol.has(symbol)) continue;
      bySymbol.set(symbol, {
        symbol,
        name: company.name?.trim() || symbol,
        sector: company.sector,
      });
    }
    return [...bySymbol.values()];
  }

  private readCompanies(): StoredCompany[] {
    try {
      const raw = localStorage.getItem(this.companiesKey) ?? this.migrateLegacy();
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return this.cleanCompanies(
            parsed.filter(
              (value): value is StoredCompany =>
                Boolean(value) &&
                typeof value === 'object' &&
                typeof (value as StoredCompany).symbol === 'string',
            ),
          );
        }
      }

      // Migrate the legacy symbols-only selection, enriching from the catalogue.
      const legacy = this.readStringList(LEGACY_TICKERS_KEY).map((symbol) => symbol.toUpperCase());
      if (legacy.length) {
        const migrated = this.cleanCompanies(
          legacy.map(
            (symbol) =>
              COMPANIES.find((company) => company.symbol === symbol) ?? { symbol, name: symbol },
          ),
        );
        this.write(this.companiesKey, migrated);
        localStorage.removeItem(LEGACY_TICKERS_KEY);
        return migrated;
      }
    } catch {
      // Ignore unavailable or invalid stored preferences.
    }
    return [];
  }

  /** Move global preferences to the first account that signs in on this browser. */
  private migrateLegacy(): string | null {
    if (!this.uid) {
      return null;
    }
    try {
      const raw = localStorage.getItem(LEGACY_COMPANIES_KEY);
      if (raw === null) {
        return null;
      }
      localStorage.setItem(this.companiesKey, raw);
      localStorage.removeItem(LEGACY_COMPANIES_KEY);
      return raw;
    } catch {
      return null;
    }
  }

  private readStringList(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return [
        ...new Set(
          parsed
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ];
    } catch {
      return [];
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }
}
