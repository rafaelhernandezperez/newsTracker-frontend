import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Company } from '../models/company.model';
import { COMPANIES } from '../data/companies.data';
import { AuthService } from './auth.service';

/** Legacy global keys (pre account-namespacing). Migrated to the first uid that logs in. */
const LEGACY_COMPANIES_KEY = 'nt.companies';
/** Pre-search versions stored only ticker symbols; migrated on first read. */
const LEGACY_TICKERS_KEY = 'nt.tickers';

/** What we persist per followed company (enough to render + query news well). */
export type StoredCompany = Pick<Company, 'symbol' | 'name' | 'sector'>;

/** Alert channels chosen in onboarding step 3. Mirrors the backend AlertPrefs. */
export type AlertPrefs = {
  priceMoves: boolean;
  highImpact: boolean;
  dailyDigest: boolean;
};

/** Matches the backend default: users who never chose get every alert. */
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  priceMoves: true,
  highImpact: true,
  dailyDigest: true,
};

/**
 * Single source of truth for the companies and alert preferences the user
 * selected during onboarding (or later edited from the watchlist). Persisted
 * to localStorage, namespaced by Firebase uid so accounts sharing a browser
 * don't share watchlists, and exposed as signals so views stay in sync.
 * Re-hydrates whenever the signed-in user changes (login/logout).
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly auth = inject(AuthService);

  private uid: string | null = this.auth.user()?.uid ?? null;

  readonly companies = signal<StoredCompany[]>(this.readCompanies());
  /** Symbols of the followed companies, derived from `companies`. */
  readonly tickers = computed(() => this.companies().map((company) => company.symbol));
  readonly alertPrefs = signal<AlertPrefs>(this.readAlertPrefs());

  constructor() {
    // Re-hydrate from the (namespaced) storage whenever the account changes.
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
          priceMoves: typeof parsed.priceMoves === 'boolean' ? parsed.priceMoves : DEFAULT_ALERT_PREFS.priceMoves,
          highImpact: typeof parsed.highImpact === 'boolean' ? parsed.highImpact : DEFAULT_ALERT_PREFS.highImpact,
          dailyDigest: typeof parsed.dailyDigest === 'boolean' ? parsed.dailyDigest : DEFAULT_ALERT_PREFS.dailyDigest,
        };
      }
    } catch {
      // fall through to defaults
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
                Boolean(value) && typeof value === 'object' && typeof (value as StoredCompany).symbol === 'string',
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
      // fall through to empty
    }
    return [];
  }

  /**
   * One-time move of the legacy global companies key to the current account's
   * namespace, so the first user to sign in on this browser keeps their
   * selection and any later account starts clean. Returns the migrated raw
   * value, if any.
   */
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
      // Storage may be unavailable (private mode, quota); selection still lives in-memory.
    }
  }
}
