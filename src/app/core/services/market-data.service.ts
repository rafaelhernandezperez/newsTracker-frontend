import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';
import {
  MarketChartPoint,
  MarketHistoryPoint,
  MarketQuote,
  MarketResponse,
  RawMarketResponse,
} from '../models/market.model';

const CACHE_TTL_MS = 60_000;

@Injectable({
  providedIn: 'root',
})
export class MarketDataService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/market';

  private readonly cache = new Map<
    string,
    { expiresAt: number; response$: Observable<MarketResponse> }
  >();

  getCompanyMarketData(ticker: string, days: number = 30): Observable<MarketResponse> {
    const key = `${ticker.toUpperCase()}:${days}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.response$;
    }

    const response$ = this.http
      .get<RawMarketResponse>(`${this.baseUrl}/${encodeURIComponent(ticker)}`, { params: { days } })
      .pipe(
        map((response) => this.normalizeResponse(response, ticker)),
        catchError((error) => {
          this.cache.delete(key);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, response$ });
    return response$;
  }

  private normalizeResponse(
    response: RawMarketResponse | null,
    requestedTicker: string,
  ): MarketResponse {
    const history = this.normalizeHistory(response?.history);
    const chart = this.normalizeChart(response?.chart, history);
    const fallbackPrice = history.at(-1)?.close ?? 0;
    const quote = this.normalizeQuote(response?.quote, requestedTicker, fallbackPrice);

    return {
      ok: response?.ok ?? true,
      ticker: (response?.ticker || quote.symbol || requestedTicker).toUpperCase(),
      quote,
      chart,
      history,
    };
  }

  private normalizeQuote(
    rawQuote: Partial<MarketQuote> | null | undefined,
    requestedTicker: string,
    fallbackPrice: number,
  ): MarketQuote {
    return {
      symbol: String(rawQuote?.symbol || requestedTicker).toUpperCase(),
      currency: typeof rawQuote?.currency === 'string' ? rawQuote.currency : null,
      price: this.toNumber(rawQuote?.price, fallbackPrice) ?? fallbackPrice,
      // Preserve missing changes as null so the UI can distinguish them from zero.
      change: this.toNumber(rawQuote?.change, null),
      volume: this.toNumber(rawQuote?.volume, 0) ?? 0,
      marketCap: this.toNumber(rawQuote?.marketCap, null),
      trailingPE: this.toNumber(rawQuote?.trailingPE, null),
      open: this.toNumber(rawQuote?.open, null),
      dayHigh: this.toNumber(rawQuote?.dayHigh, null),
      dayLow: this.toNumber(rawQuote?.dayLow, null),
      fiftyTwoWeekHigh: this.toNumber(rawQuote?.fiftyTwoWeekHigh, null),
      fiftyTwoWeekLow: this.toNumber(rawQuote?.fiftyTwoWeekLow, null),
    };
  }

  private normalizeChart(rawChart: unknown, history: MarketHistoryPoint[]): MarketChartPoint[] {
    if (Array.isArray(rawChart)) {
      return rawChart
        .map((point): MarketChartPoint | null => {
          if (!point || typeof point !== 'object') {
            return null;
          }

          const entry = point as Record<string, unknown>;
          const value = this.toNumber(entry['value'], null);
          const date = String(entry['date'] ?? '');

          if (value === null || !date) {
            return null;
          }

          return { date, value };
        })
        .filter((point): point is MarketChartPoint => point !== null);
    }

    return history
      .filter((point) => typeof point.close === 'number')
      .map((point) => ({
        date: point.date,
        value: point.close as number,
      }));
  }

  private normalizeHistory(rawHistory: unknown): MarketHistoryPoint[] {
    if (!Array.isArray(rawHistory)) {
      return [];
    }

    return rawHistory
      .map((point): MarketHistoryPoint | null => {
        if (!point || typeof point !== 'object') {
          return null;
        }

        const entry = point as Record<string, unknown>;
        const date = String(entry['date'] ?? '');

        if (!date) {
          return null;
        }

        return {
          date,
          open: this.toNumber(entry['open'], null),
          high: this.toNumber(entry['high'], null),
          low: this.toNumber(entry['low'], null),
          close: this.toNumber(entry['close'], null),
          volume: this.toNumber(entry['volume'], null),
        };
      })
      .filter((point): point is MarketHistoryPoint => point !== null);
  }

  private toNumber(value: unknown, fallback: number | null): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}
