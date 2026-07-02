import { Injectable, computed, signal } from '@angular/core';
import { Company } from '../models/company.model';
import { COMPANIES } from '../data/companies.data';

const COMPANIES_KEY = 'nt.companies';
/** Pre-search versions stored only ticker symbols; migrated on first read. */
const LEGACY_TICKERS_KEY = 'nt.tickers';
const TOPICS_KEY = 'nt.topics';

/** What we persist per followed company (enough to render + query news well). */
export type StoredCompany = Pick<Company, 'symbol' | 'name' | 'sector'>;

/**
 * Single source of truth for the companies and topics the user selected during
 * onboarding (or later edited from the watchlist). Persisted to localStorage so
 * the selection survives reloads, and exposed as signals so views stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  readonly companies = signal<StoredCompany[]>(this.readCompanies());
  /** Symbols of the followed companies, derived from `companies`. */
  readonly tickers = computed(() => this.companies().map((company) => company.symbol));
  readonly topics = signal<string[]>(this.readStringList(TOPICS_KEY));

  setCompanies(companies: StoredCompany[]): void {
    const cleaned = this.cleanCompanies(companies);
    this.companies.set(cleaned);
    this.write(COMPANIES_KEY, cleaned);
  }

  setTopics(topics: string[]): void {
    const cleaned = [...new Set(topics.map((value) => value.trim()).filter(Boolean))];
    this.topics.set(cleaned);
    this.write(TOPICS_KEY, cleaned);
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
      const raw = localStorage.getItem(COMPANIES_KEY);
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
        this.write(COMPANIES_KEY, migrated);
        return migrated;
      }
    } catch {
      // fall through to empty
    }
    return [];
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
