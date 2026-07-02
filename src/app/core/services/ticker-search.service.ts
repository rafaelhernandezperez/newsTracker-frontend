import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Company } from '../models/company.model';

type TickerSearchResponse = {
  ok: boolean;
  items?: { symbol?: string; name?: string; exchange?: string; sector?: string }[];
};

/**
 * Free-text company/ticker search against `/api/tickers/search` (Yahoo Finance
 * lookup), so users can follow ANY listed company — not just the curated list.
 */
@Injectable({ providedIn: 'root' })
export class TickerSearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/tickers/search';

  search(query: string): Observable<Company[]> {
    return this.http
      .get<TickerSearchResponse>(this.baseUrl, { params: { q: query } })
      .pipe(
        map((response) =>
          (response.items ?? [])
            .filter((item): item is { symbol: string; name: string; exchange?: string; sector?: string } =>
              Boolean(item.symbol && item.name),
            )
            .map(
              (item): Company => ({
                symbol: item.symbol.toUpperCase(),
                name: item.name,
                sector: item.sector || 'Markets',
                summary: item.exchange ? `Listed on ${item.exchange}.` : undefined,
              }),
            ),
        ),
      );
  }
}
