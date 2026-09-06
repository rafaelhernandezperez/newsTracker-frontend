import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { StoredCompany, UserPreferencesService } from './user-preferences.service';

type WatchlistResponse = {
  ok: boolean;
  items: { ticker: string; companyName?: string | null }[];
};

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly http = inject(HttpClient);
  private readonly preferences = inject(UserPreferencesService);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/api/watchlist';

  /** Save locally first, then sync authenticated users’ watchlists to the server. */
  async save(companies: StoredCompany[]): Promise<void> {
    this.preferences.setCompanies(companies);

    if (this.auth.isAuthenticated) {
      await this.sync(companies);
    }
  }

  async fetch(): Promise<StoredCompany[]> {
    const response = await firstValueFrom(this.http.get<WatchlistResponse>(this.baseUrl));
    return (response.items ?? [])
      .map((item) => {
        const symbol = String(item.ticker ?? '').toUpperCase();
        return { symbol, name: item.companyName?.trim() || symbol };
      })
      .filter((company) => Boolean(company.symbol));
  }

  async sync(companies: StoredCompany[]): Promise<void> {
    const desired = new Map(companies.map((company) => [company.symbol.toUpperCase(), company]));

    let current: StoredCompany[] = [];
    try {
      current = await this.fetch();
    } catch {
      // Treat a failed fetch as empty and attempt to add the desired companies.
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
