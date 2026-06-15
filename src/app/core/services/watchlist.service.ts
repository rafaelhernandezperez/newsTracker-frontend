import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { COMPANIES } from '../data/companies.data';

type WatchlistResponse = {
  ok: boolean;
  items: { ticker: string; companyName?: string | null }[];
};

/**
 * Mirrors the user's selected tickers to the server-side watchlist
 * (`/api/watchlist`, keyed by Firebase uid). The daily digest reads this
 * Firestore watchlist to know which tickers each user follows, so syncing it is
 * what makes per-user alerts possible.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/watchlist';

  /** Pull the server watchlist (used to hydrate local prefs after login). */
  async fetch(): Promise<string[]> {
    const response = await firstValueFrom(this.http.get<WatchlistResponse>(this.baseUrl));
    return (response.items ?? [])
      .map((item) => String(item.ticker ?? '').toUpperCase())
      .filter(Boolean);
  }

  /**
   * Make the server watchlist match `tickers` exactly: add the missing ones and
   * remove the extras. Best-effort and idempotent.
   */
  async sync(tickers: string[]): Promise<void> {
    const desired = new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean));

    let current: string[] = [];
    try {
      current = await this.fetch();
    } catch {
      // No existing watchlist (or transient error) — treat as empty and add all.
    }
    const existing = new Set(current);

    const toAdd = [...desired].filter((t) => !existing.has(t));
    const toRemove = [...existing].filter((t) => !desired.has(t));

    await Promise.all([
      ...toAdd.map((ticker) =>
        firstValueFrom(
          this.http.post(this.baseUrl, {
            ticker,
            companyName: COMPANIES.find((c) => c.symbol === ticker)?.name,
          }),
        ).catch(() => undefined),
      ),
      ...toRemove.map((ticker) =>
        firstValueFrom(this.http.delete(`${this.baseUrl}/${ticker}`)).catch(() => undefined),
      ),
    ]);
  }
}
