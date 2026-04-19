import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { NewsItem, NewsResponse } from '../models/news.model';

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

  getCompanyNews(
    ticker: string,
    companyName?: string,
    query: CompanyNewsQuery = {},
  ): Observable<NewsResponse> {
    const params: Record<string, string | number> = {
      limit: query.limit ?? 6,
      _: Date.now(),
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

    return this.http
      .get<Partial<NewsResponse>>(`${this.baseUrl}/${ticker}`, {
        headers: new HttpHeaders({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        }),
        params,
      })
      .pipe(map((response) => this.normalizeResponse(response, ticker)));
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
      pubDate: typeof entry['pubDate'] === 'string' ? entry['pubDate'] : undefined,
      isoDate: typeof entry['isoDate'] === 'string' ? entry['isoDate'] : undefined,
      language: typeof entry['language'] === 'string' ? entry['language'] : undefined,
      matchedTickers: Array.isArray(entry['matchedTickers'])
        ? entry['matchedTickers'].filter((value): value is string => typeof value === 'string')
        : [],
      score: typeof entry['score'] === 'number' ? entry['score'] : 0,
    };
  }
}
