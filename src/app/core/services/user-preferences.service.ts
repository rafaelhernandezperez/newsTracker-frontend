import { Injectable, signal } from '@angular/core';

const TICKERS_KEY = 'nt.tickers';
const TOPICS_KEY = 'nt.topics';

/**
 * Single source of truth for the companies and topics the user selected during
 * onboarding (or later edited from the watchlist). Persisted to localStorage so
 * the selection survives reloads, and exposed as signals so views stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  readonly tickers = signal<string[]>(this.read(TICKERS_KEY, true));
  readonly topics = signal<string[]>(this.read(TOPICS_KEY, false));

  setTickers(tickers: string[]): void {
    const cleaned = this.clean(tickers, true);
    this.tickers.set(cleaned);
    this.write(TICKERS_KEY, cleaned);
  }

  setTopics(topics: string[]): void {
    const cleaned = this.clean(topics, false);
    this.topics.set(cleaned);
    this.write(TOPICS_KEY, cleaned);
  }

  private clean(values: string[], uppercase: boolean): string[] {
    const normalized = values
      .map((value) => (uppercase ? value.trim().toUpperCase() : value.trim()))
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  private read(key: string, uppercase: boolean): string[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.clean(
        parsed.filter((value): value is string => typeof value === 'string'),
        uppercase,
      );
    } catch {
      return [];
    }
  }

  private write(key: string, values: string[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      // Storage may be unavailable (private mode, quota); selection still lives in-memory.
    }
  }
}
