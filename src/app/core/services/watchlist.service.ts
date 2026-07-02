import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StoredCompany } from './user-preferences.service';

type WatchlistResponse = {
  ok: boolean;
  items: { ticker: string; companyName?: string | null }[];
};

/**
 * Mirrors the user's selected companies to the server-side watchlist
 * (`/api/watchlist`, keyed by Firebase uid). The daily digest reads this
 * Firestore watchlist to know which tickers each user follows, so syncing it is
 * what makes per-user alerts possible.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/watchlist';

  /** Pull the server watchlist (used to hydrate local prefs after login). */
  async fetch(): Promise<StoredCompany[]> {
    const response = await firstValueFrom(this.http.get<WatchlistResponse>(this.baseUrl));
    return (response.items ?? [])
      .map((item) => {
        const symbol = String(item.ticker ?? '').toUpperCase();
        return { symbol, name: item.companyName?.trim() || symbol };
      })
      .filter((company) => Boolean(company.symbol));
  }

  /**
   * Make the server watchlist match `companies` exactly: add the missing ones
   * and remove the extras. Best-effort and idempotent.
   */
  async sync(companies: StoredCompany[]): Promise<void> {
    const desired = new Map(companies.map((company) => [company.symbol.toUpperCase(), company]));

    let current: StoredCompany[] = [];
    try {
      current = await this.fetch();
    } catch {
      // No existing watchlist (or transient error) — treat as empty and add all.
    }
    const existing = new Set(current.map((company) => company.symbol));

    const toAdd = [...desired.values()].filter((company) => !existing.has(company.symbol));
    const toRemove = [...existing].filter((symbol) => !desired.has(symbol));

    await Promise.all([
      ...toAdd.map((company) =>
        firstValueFrom(
          this.http.post(this.baseUrl, {
            ticker: company.symbol,
            companyName: company.name,
          }),
        ).catch(() => undefined),
      ),
      ...toRemove.map((symbol) =>
        firstValueFrom(this.http.delete(`${this.baseUrl}/${symbol}`)).catch(() => undefined),
      ),
    ]);
  }
}
