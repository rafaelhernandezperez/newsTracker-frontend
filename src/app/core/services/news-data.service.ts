import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';
import { NewsImportance, NewsItem, NewsResponse, NewsSentiment } from '../models/news.model';

/** How long an identical request is served from memory instead of refetched. */
const CACHE_TTL_MS = 60_000;

const IMPORTANCE_VALUES: NewsImportance[] = [
  'MUY_IMPORTANTE',
  'IMPORTANTE',
  'NEUTRO',
  'POCO_RELEVANTE',
];
const SENTIMENT_VALUES: NewsSentiment[] = ['POSITIVO', 'NEGATIVO', 'NEUTRO'];

export interface CompanyNewsQuery {
  limit?: number;
  range?: string;
  from?: string;
  to?: string;
  daysBack?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NewsDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/news';
  /** Small in-memory TTL cache so repeat navigation doesn't refetch identical data. */
  private readonly cache = new Map<string, { expiresAt: number; response$: Observable<NewsResponse> }>();

  getCompanyNews(
    ticker: string,
    companyName?: string,
    query: CompanyNewsQuery = {},
  ): Observable<NewsResponse> {
    const params: Record<string, string | number> = {
      limit: query.limit ?? 6,
    };

    if (companyName) {
      params['companyName'] = companyName;
    }

    if (query.range) {
      params['range'] = query.range;
    }

    if (query.from) {
      params['from'] = query.from;
    }

    if (query.to) {
      params['to'] = query.to;
    }

    if (typeof query.daysBack === 'number' && Number.isFinite(query.daysBack)) {
      params['daysBack'] = query.daysBack;
    }

    const key = `${ticker.toUpperCase()}:${JSON.stringify(params)}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.response$;
    }

    const response$ = this.http
      .get<Partial<NewsResponse>>(`${this.baseUrl}/${ticker}`, { params })
      .pipe(
        map((response) => this.normalizeResponse(response, ticker)),
        catchError((error) => {
          // Don't cache failures; the next call should retry.
          this.cache.delete(key);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, response$ });
    return response$;
  }

  private normalizeResponse(response: Partial<NewsResponse> | null, ticker: string): NewsResponse {
    const items = Array.isArray(response?.items)
      ? response.items.map((item) => this.normalizeItem(item)).filter((item): item is NewsItem => item !== null)
      : [];

    return {
      ok: response?.ok ?? true,
      ticker: String(response?.ticker ?? ticker).toUpperCase(),
      count: typeof response?.count === 'number' ? response.count : items.length,
      items,
    };
  }

  private normalizeItem(rawItem: unknown): NewsItem | null {
    if (!rawItem || typeof rawItem !== 'object') {
      return null;
    }

    const entry = rawItem as Record<string, unknown>;
    const title = typeof entry['title'] === 'string' ? entry['title'].trim() : '';
    const link = typeof entry['link'] === 'string' ? entry['link'].trim() : '';
    const source = typeof entry['source'] === 'string' ? entry['source'].trim() : '';

    if (!title || !link || !source) {
      return null;
    }

    return {
      id: typeof entry['id'] === 'string' ? entry['id'] : `${source}-${title}`,
      title,
      link,
      source,
      summary: typeof entry['summary'] === 'string' ? entry['summary'].trim() : '',
      aiSummary: typeof entry['aiSummary'] === 'string' ? entry['aiSummary'].trim() : undefined,
      pubDate: typeof entry['pubDate'] === 'string' ? entry['pubDate'] : undefined,
      isoDate: typeof entry['isoDate'] === 'string' ? entry['isoDate'] : undefined,
      language: typeof entry['language'] === 'string' ? entry['language'] : undefined,
      matchedTickers: Array.isArray(entry['matchedTickers'])
        ? entry['matchedTickers'].filter((value): value is string => typeof value === 'string')
        : [],
      score: typeof entry['score'] === 'number' ? entry['score'] : 0,
      importance: this.parseEnum(entry['importance'], IMPORTANCE_VALUES),
      sentiment: this.parseEnum(entry['sentiment'], SENTIMENT_VALUES),
    };
  }

  private parseEnum<T extends string>(value: unknown, allowed: T[]): T | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase() as T;
    return allowed.includes(normalized) ? normalized : undefined;
  }
}
