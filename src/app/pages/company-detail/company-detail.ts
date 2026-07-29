import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
  timeout,
} from 'rxjs';
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { COMPANIES } from '../../core/data/companies.data';
import { Company } from '../../core/models/company.model';
import {
  MarketChartPoint,
  MarketHistoryPoint,
  MarketQuote,
  MarketResponse,
} from '../../core/models/market.model';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsImportance, NewsItem, NewsSentiment } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';

type NavItem = {
  label: string;
  link: string | any[];
  active?: boolean;
};

type WatchlistRow = {
  symbol: string;
  name?: string;
  change: string;
  direction: 'positive' | 'negative' | 'neutral';
  sector?: string;
};

type StatCard = {
  label: string;
  value: string;
};

type RelatedNewsItem = {
  id: string;
  source: string;
  age: string;
  title: string;
  summary: string;
  link?: string;
  publishedAt?: string;
  dateKey?: string;
  tags: string[];
  accent: 'positive' | 'negative' | 'neutral';
  importance?: NewsImportance;
  sentiment?: NewsSentiment;
  language?: string;
};

type TimeframeOption = {
  label: '5D' | '1M' | '3M' | '1Y';
  days: number;
};

/** Combined market + news payload for one timeframe selection. */
type TimeframeData = {
  market: { response: MarketResponse | null; error: string | null };
  chartNews: RelatedNewsItem[];
  relatedNews: RelatedNewsItem[];
};

@Component({
  selector: 'app-company-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './company-detail.html',
  styleUrl: './company-detail.css',
})
export class CompanyDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly marketDataService = inject(MarketDataService);
  private readonly newsDataService = inject(NewsDataService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  /** Current ticker; follows the route param so in-page navigation reloads data. */
  private symbol = this.route.snapshot.paramMap.get('symbol');
  /** Timeframe selections; switchMap cancels the in-flight requests on a new pick. */
  private readonly timeframe$ = new Subject<TimeframeOption>();

  @ViewChild('chartContainer') private chartContainer?: ElementRef<HTMLDivElement>;
  private chart?: IChartApi;
  private series?: ISeriesApi<'Area'>;
  private markersPlugin?: ISeriesMarkersPluginApi<Time>;
  /** Maps a chart time (yyyy-mm-dd) to the news item behind its marker, for click handling. */
  private markerLookup = new Map<string, RelatedNewsItem>();

  readonly timeframeOptions: TimeframeOption[] = [
    { label: '5D', days: 5 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '1Y', days: 365 },
  ];
  activeTimeframe: TimeframeOption['label'] = '1M';
  isWatchlistOpen = false;
  get navItems(): NavItem[] {
    const detailRoute = this.symbol ? `/portfolio/${this.symbol}` : '/portfolio';

    return [
      { label: 'Dashboard', link: '/portfolio' },
      { label: 'Stock detail', link: detailRoute, active: true },
    ];
  }

  company = this.findCompany(this.symbol);

  quote: MarketQuote | null = null;
  chartData: MarketChartPoint[] = [];
  history: MarketHistoryPoint[] = [];
  hasChartData = false;
  isLoading = true;
  errorMessage = '';
  /** Dated stories used exclusively for markers across the selected chart range. */
  chartNewsItems: RelatedNewsItem[] = [];
  /** Stories rendered in the Related News section below the chart. */
  relatedNewsItems: RelatedNewsItem[] = [];
  selectedNewsItem: RelatedNewsItem | null = null;
  /** When the current market snapshot was received (for the "Updated ..." label). */
  lastUpdatedAt: Date | null = null;

  watchlistRows: WatchlistRow[] = [];

  ngOnInit(): void {
    this.loadWatchlist();

    this.timeframe$
      .pipe(
        switchMap((timeframe) => this.fetchTimeframeData(timeframe)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.applyTimeframeData(data));

    // Navigating to another company from this page (watchlist links) reuses
    // this component instance, so follow the route param instead of reading it
    // once: each new symbol resets the view and reloads market + news data.
    this.route.paramMap
      .pipe(
        map((params) => params.get('symbol')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((symbol) => this.onSymbolChange(symbol));
  }

  private onSymbolChange(symbol: string | null): void {
    this.symbol = symbol;
    this.company = this.findCompany(symbol);

    if (!symbol) {
      this.isLoading = false;
      this.errorMessage = 'No ticker was provided.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    // Clear the previous company's data so it doesn't linger under the loader.
    this.quote = null;
    this.chartData = [];
    this.history = [];
    this.chartNewsItems = [];
    this.relatedNewsItems = [];
    this.selectedNewsItem = null;
    this.lastUpdatedAt = null;
    this.errorMessage = '';
    // On mobile the watchlist is a drawer; close it after picking a company.
    this.isWatchlistOpen = false;
    this.buildChart();

    this.timeframe$.next(this.getTimeframeOption(this.activeTimeframe));
  }

  private loadWatchlist(): void {
    const tickers = this.preferences.tickers().slice(0, 8);

    if (!tickers.length) {
      this.watchlistRows = [];
      return;
    }

    forkJoin(
      tickers.map((symbol) =>
        this.marketDataService.getCompanyMarketData(symbol, 5).pipe(
          map((response) => this.mapWatchlistRow(symbol, response.quote)),
          catchError(() => of(this.mapWatchlistRow(symbol, null))),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.watchlistRows = rows;
        this.changeDetectorRef.markForCheck();
      });
  }

  private mapWatchlistRow(symbol: string, quote: MarketQuote | null): WatchlistRow {
    const company = this.findCompany(symbol);
    const name = company?.name;
    const sector = company?.sector;

    // Em-dash when the quote is missing or the backend reported no change.
    if (!quote || quote.change == null) {
      return { symbol, name, change: '—', direction: 'neutral', sector };
    }

    const change = quote.change;
    const direction = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return { symbol, name, change: `${sign}${change.toFixed(1)}%`, direction, sector };
  }

  toggleWatchlist(): void {
    this.isWatchlistOpen = !this.isWatchlistOpen;
  }

  openNewsModal(item: RelatedNewsItem): void {
    this.selectedNewsItem = item;
  }

  closeNewsModal(): void {
    this.selectedNewsItem = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedNewsItem) {
      this.closeNewsModal();
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  selectTimeframe(timeframe: TimeframeOption): void {
    if (timeframe.label === this.activeTimeframe || !this.symbol) {
      return;
    }

    this.activeTimeframe = timeframe.label;
    this.timeframe$.next(timeframe);
  }

  get absoluteChangeLabel(): string {
    if (this.quote?.change == null) {
      return '—';
    }

    return `${Math.abs(this.quote.change).toFixed(1)}%`;
  }

  get lastUpdatedLabel(): string {
    if (!this.lastUpdatedAt) {
      return '';
    }

    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.lastUpdatedAt);
  }

  get statCards(): StatCard[] {
    const latestPoint = this.history.at(-1);
    const fallbackValue = this.quote?.price ?? latestPoint?.close ?? null;

    return [
      {
        label: 'Open',
        value: this.formatCurrency(this.quote?.open ?? latestPoint?.open ?? null, fallbackValue),
      },
      {
        label: 'Day high',
        value: this.formatCurrency(
          this.quote?.dayHigh ?? this.getHistoryExtreme('high', 'max'),
          fallbackValue,
        ),
      },
      {
        label: 'Day low',
        value: this.formatCurrency(
          this.quote?.dayLow ?? this.getHistoryExtreme('low', 'min'),
          fallbackValue,
        ),
      },
      {
        label: 'Volume',
        value: this.formatCompactNumber(this.quote?.volume ?? latestPoint?.volume ?? null),
      },
      {
        label: '52w high',
        value: this.formatCurrency(
          this.quote?.fiftyTwoWeekHigh ?? this.getHistoryExtreme('high', 'max'),
          fallbackValue,
        ),
      },
      {
        label: '52w low',
        value: this.formatCurrency(
          this.quote?.fiftyTwoWeekLow ?? this.getHistoryExtreme('low', 'min'),
          fallbackValue,
        ),
      },
      {
        label: 'P/E ratio',
        value:
          typeof this.quote?.trailingPE === 'number' ? `${this.quote.trailingPE.toFixed(2)}x` : '--',
      },
      {
        label: 'Mkt cap',
        value: this.formatCompactCurrency(this.quote?.marketCap ?? null),
      },
    ];
  }

  get priceLabel(): string {
    return this.quote ? this.formatCurrency(this.quote.price, this.quote.price) : '--';
  }

  get quoteDirection(): 'positive' | 'negative' {
    return this.quote?.change != null && this.quote.change < 0 ? 'negative' : 'positive';
  }

  /**
   * Fire the market and news requests for one timeframe together. Consumed via
   * switchMap so a newer selection cancels both in-flight requests, and
   * `buildChart` runs exactly once per timeframe with both results in hand.
   */
  private fetchTimeframeData(timeframe: TimeframeOption): Observable<TimeframeData> {
    const symbol = this.symbol as string;

    this.isLoading = true;
    this.errorMessage = '';
    this.changeDetectorRef.markForCheck();

    const market$ = this.marketDataService.getCompanyMarketData(symbol, timeframe.days).pipe(
      timeout(10000),
      map((response) => ({ response, error: null as string | null })),
      catchError((error) => {
        console.error('[company-detail] Market request failed:', error);
        return of({ response: null, error: this.getMarketErrorMessage(error) });
      }),
    );

    const chartNews$ = this.newsDataService
      .getCompanyNews(symbol, this.company?.name, {
        // Scale with the window so longer timeframes get more dated markers
        // spread across the chart (the marker layer dedupes by day).
        limit: this.newsLimitForTimeframe(timeframe.days),
        range: timeframe.label,
        daysBack: timeframe.days,
      })
      .pipe(
        map((response) => response.items.map((item) => this.mapRelatedNewsItem(item))),
        catchError(() => of([] as RelatedNewsItem[])),
      );

    // The compact 5D chart still needs dated marker coverage across its full
    // range, but the list below it is intentionally a live "today" feed.
    // Longer views use their full ranged response for both chart and list.
    const relatedNews$ =
      timeframe.label === '5D'
        ? this.newsDataService
            .getCompanyNews(symbol, this.company?.name, {
              limit: 8,
              from: this.localTodayDateKey(),
              rssOnly: true,
            })
            .pipe(
              map((response) => response.items.map((item) => this.mapRelatedNewsItem(item))),
              catchError(() => of([] as RelatedNewsItem[])),
            )
        : chartNews$;

    return forkJoin({ market: market$, chartNews: chartNews$, relatedNews: relatedNews$ });
  }

  /** Apply a timeframe's market + news payload and redraw the chart once. */
  private applyTimeframeData({ market, chartNews, relatedNews }: TimeframeData): void {
    this.isLoading = false;
    this.chartNewsItems = chartNews;
    this.relatedNewsItems = relatedNews;

    if (market.response) {
      try {
        this.company = this.findCompany(market.response.ticker);
        this.quote = market.response.quote;
        this.chartData = market.response.chart;
        this.history = market.response.history;
        this.lastUpdatedAt = new Date();
      } catch (error) {
        console.error('[company-detail] Error processing market response:', error);
        this.errorMessage = 'The backend responded, but the payload could not be processed.';
      }
    } else {
      this.errorMessage = market.error ?? 'Market data could not be loaded.';
    }

    this.buildChart();
    this.changeDetectorRef.markForCheck();
  }

  ngAfterViewInit(): void {
    this.createChart();
    this.buildChart();
  }

  ngOnDestroy(): void {
    this.markersPlugin = undefined;
    this.series = undefined;
    this.chart?.remove();
    this.chart = undefined;
  }

  /** Create the TradingView Lightweight Charts instance once the container exists. */
  private createChart(): void {
    const container = this.chartContainer?.nativeElement;

    if (!container || this.chart) {
      return;
    }

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(231, 229, 228, 0.55)',
        fontFamily: getComputedStyle(container).fontFamily,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: 0 },
    });

    this.series = this.chart.addSeries(AreaSeries, {
      lineColor: '#21c996',
      topColor: 'rgba(33, 201, 150, 0.28)',
      bottomColor: 'rgba(33, 201, 150, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
    });

    this.markersPlugin = createSeriesMarkers(this.series, []);

    // Markers aren't directly clickable, so resolve the clicked time back to the
    // news item behind the marker at that point and open the detail modal.
    this.chart.subscribeClick((param) => {
      if (param.time === undefined) {
        return;
      }

      const item = this.markerLookup.get(this.timeToKey(param.time));

      if (!item) {
        return;
      }

      this.ngZone.run(() => {
        this.openNewsModal(item);
        this.changeDetectorRef.markForCheck();
      });
    });
  }

  /** Push the latest price series + news markers into the chart. */
  private buildChart(): void {
    this.hasChartData = this.chartData.length >= 2;

    if (!this.series) {
      return;
    }

    if (!this.hasChartData) {
      this.series.setData([]);
      this.markersPlugin?.setMarkers([]);
      this.markerLookup.clear();
      return;
    }

    const seriesData = [...this.chartData]
      .filter((point) => Boolean(point.date))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .reduce<{ time: string; value: number }[]>((acc, point) => {
        const last = acc[acc.length - 1];
        // Collapse any duplicate dates (Lightweight Charts requires unique, ascending times).
        if (last && last.time === point.date) {
          last.value = point.value;
        } else {
          acc.push({ time: point.date, value: point.value });
        }
        return acc;
      }, []);

    this.series.setData(seriesData);
    this.markersPlugin?.setMarkers(this.buildNewsMarkers(seriesData));
    this.chart?.timeScale().fitContent();
  }

  /**
   * Place a circle on the price line at each article's actual publish date.
   * IMPORTANCIA drives the circle size; SENTIMIENTO drives its color. When more
   * than one article lands on the same chart day, the most important one wins.
   *
   * Note: the free news feed only returns recent headlines, so until a
   * historical news source is wired up, markers naturally cluster on the latest
   * points (that's where the dated news actually is).
   */
  private buildNewsMarkers(data: { time: string; value: number }[]): SeriesMarker<Time>[] {
    this.markerLookup.clear();

    if (data.length < 2 || !this.chartNewsItems.length) {
      return [];
    }

    // Snap each article to the nearest chart point by its real publish date.
    const chosen = new Map<string, { item: RelatedNewsItem; rank: number; value: number }>();
    for (const item of this.chartNewsItems) {
      if (!item.dateKey) {
        continue;
      }

      // Allow a few days of slack so weekend/holiday news still lands on a
      // trading day, but never on a date the chart doesn't actually show.
      const index = this.nearestIndex(data, item.dateKey, 4);
      if (index < 0) {
        continue;
      }

      const point = data[index];
      const rank = this.importanceRank(item.importance);
      const existing = chosen.get(point.time);
      if (!existing || rank > existing.rank) {
        chosen.set(point.time, { item, rank, value: point.value });
      }
    }

    // Lightweight Charts requires markers in ascending time order.
    return [...chosen.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([time, { item, value }]) => {
        this.markerLookup.set(time, item);
        const sentiment = this.getMarkerSentiment(item);

        return {
          time,
          // Sit exactly on the line at this point's price.
          position: 'atPriceMiddle',
          price: value,
          shape: 'circle',
          color: this.sentimentColor(sentiment),
          size: this.importanceSize(item.importance),
        } satisfies SeriesMarker<Time>;
      });
  }

  /** Nearest chart point to a news date, within `maxDays`; -1 if none close enough. */
  private nearestIndex(data: { time: string }[], dateKey: string, maxDays: number): number {
    const target = new Date(`${dateKey}T00:00:00`).getTime();
    if (Number.isNaN(target)) {
      return -1;
    }

    let bestIndex = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(new Date(`${data[i].time}T00:00:00`).getTime() - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }

    return bestDiff <= maxDays * 24 * 60 * 60 * 1000 ? bestIndex : -1;
  }

  private importanceRank(importance?: NewsImportance): number {
    switch (importance) {
      case 'MUY_IMPORTANTE':
        return 3;
      case 'IMPORTANTE':
        return 2;
      case 'POCO_RELEVANTE':
        return 0;
      default:
        return 1;
    }
  }

  private importanceSize(importance?: NewsImportance): number {
    switch (importance) {
      case 'MUY_IMPORTANTE':
        return 3.6;
      case 'IMPORTANTE':
        return 2.1;
      case 'POCO_RELEVANTE':
        return 0.7;
      default:
        return 1.25;
    }
  }

  private sentimentColor(sentiment: 'positive' | 'neutral' | 'negative'): string {
    if (sentiment === 'positive') {
      return '#21c996';
    }

    if (sentiment === 'negative') {
      return '#f1675c';
    }

    return '#9ca3af';
  }

  private timeToKey(time: Time): string {
    if (typeof time === 'string') {
      return time;
    }

    if (typeof time === 'object' && 'year' in time) {
      const month = String(time.month).padStart(2, '0');
      const day = String(time.day).padStart(2, '0');
      return `${time.year}-${month}-${day}`;
    }

    return String(time);
  }

  private newsLimitForTimeframe(days: number): number {
    if (days <= 5) {
      return 8;
    }
    if (days <= 30) {
      return 12;
    }
    if (days <= 90) {
      return 30;
    }
    return 40;
  }

  /** Current local calendar day in the API's yyyy-mm-dd query format. */
  private localTodayDateKey(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTimeframeOption(label: TimeframeOption['label']): TimeframeOption {
    return this.timeframeOptions.find((option) => option.label === label) ?? this.timeframeOptions[1];
  }

  private getHistoryExtreme(key: 'high' | 'low', mode: 'max' | 'min'): number | null {
    const values = this.history
      .map((point) => point[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (!values.length) {
      return null;
    }

    return mode === 'max' ? Math.max(...values) : Math.min(...values);
  }

  /** Resolve a symbol via the curated catalogue, then the user's saved companies. */
  private findCompany(symbol: string | null): Company | null {
    if (!symbol) {
      return null;
    }

    const upper = symbol.toUpperCase();
    return (
      COMPANIES.find((item) => item.symbol === upper) ??
      this.preferences.companies().find((item) => item.symbol === upper) ??
      this.createFallbackCompany(upper)
    );
  }

  private createFallbackCompany(symbol: string | null): Company | null {
    if (!symbol) {
      return null;
    }

    return {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      summary: 'The latest story associated with this company will appear here.',
    };
  }

  private getMarketErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'The market request timed out or returned an invalid response.';
    }

    if (error.status === 0) {
      return 'The frontend could not reach the backend. Check that the server is running and the proxy is configured.';
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return `Market data could not be loaded (${error.status}).`;
  }

  private mapRelatedNewsItem(item: NewsItem): RelatedNewsItem {
    const publishedAt = item.isoDate ?? item.pubDate;

    return {
      id: item.id,
      source: item.source,
      age: this.formatRelativeDate(publishedAt, item.language),
      title: item.localizedTitle?.trim() || item.title,
      summary:
        item.aiSummary?.trim() ||
        item.summary?.trim() ||
        '',
      link: item.link,
      publishedAt,
      dateKey: this.toDateKey(publishedAt),
      tags: this.buildNewsTags(item),
      accent: this.getNewsAccent(item),
      importance: item.importance,
      sentiment: item.sentiment,
      language: item.language,
    };
  }

  private getMarkerSentiment(item: RelatedNewsItem): 'positive' | 'neutral' | 'negative' {
    // Prefer the AI sentiment; fall back to the news-list accent if it's missing.
    if (item.sentiment === 'POSITIVO') {
      return 'positive';
    }

    if (item.sentiment === 'NEGATIVO') {
      return 'negative';
    }

    if (item.sentiment === 'NEUTRO') {
      return 'neutral';
    }

    if (item.accent === 'positive') {
      return 'positive';
    }

    if (item.accent === 'negative') {
      return 'negative';
    }

    return 'neutral';
  }

  private buildNewsTags(item: NewsItem): string[] {
    const tags = [
      item.language?.toUpperCase(),
      item.matchedTickers[0],
      this.importanceLabel(item.importance, item.language),
    ].filter((value): value is string => Boolean(value));

    return tags.length ? tags.slice(0, 3) : ['headline'];
  }

  private importanceLabel(importance?: NewsImportance, language?: string): string {
    const spanish = this.isSpanish(language);

    switch (importance) {
      case 'MUY_IMPORTANTE':
        return spanish ? 'Muy importante' : 'Very important';
      case 'IMPORTANTE':
        return spanish ? 'Importante' : 'Important';
      case 'POCO_RELEVANTE':
        return spanish ? 'Poco relevante' : 'Low relevance';
      case 'NEUTRO':
        return spanish ? 'Importancia neutral' : 'Neutral importance';
      default:
        return spanish ? 'Importancia pendiente' : 'Importance pending';
    }
  }

  isSpanish(language?: string): boolean {
    return language?.trim().toLowerCase().startsWith('es') ?? false;
  }

  private getNewsAccent(item: NewsItem): RelatedNewsItem['accent'] {
    if (item.sentiment === 'POSITIVO') {
      return 'positive';
    }

    if (item.sentiment === 'NEGATIVO') {
      return 'negative';
    }

    return 'neutral';
  }

  private formatRelativeDate(value?: string, language?: string): string {
    const spanish = this.isSpanish(language);

    if (!value) {
      return spanish ? 'Reciente' : 'Latest';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return spanish ? 'Reciente' : 'Latest';
    }

    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

    if (diffHours < 24) {
      return spanish ? `hace ${diffHours} h` : `${diffHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return spanish ? `hace ${diffDays} d` : `${diffDays}d ago`;
  }

  private toDateKey(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString().slice(0, 10);
  }

  private formatCurrency(value: number | null | undefined, fallbackValue?: number | null): string {
    const amount = typeof value === 'number' ? value : fallbackValue;

    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return '--';
    }

    const currency = this.quote?.currency ?? (this.company?.sector === 'Banca' ? 'EUR' : 'USD');

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private formatCompactCurrency(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '--';
    }

    const currency = this.quote?.currency ?? (this.company?.sector === 'Banca' ? 'EUR' : 'USD');

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatCompactNumber(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '--';
    }

    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
