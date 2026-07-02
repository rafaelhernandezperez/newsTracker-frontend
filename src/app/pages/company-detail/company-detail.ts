import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
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
} from '../../core/models/market.model';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsImportance, NewsItem, NewsSentiment } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';

type NavItem = {
  label: string;
  link: string | any[];
  active?: boolean;
};

type WatchlistRow = {
  symbol: string;
  change: string;
  direction: 'positive' | 'negative' | 'neutral';
  sector?: string;
};

type StatCard = {
  label: string;
  value: string;
};

type RelatedNewsItem = {
  source: string;
  age: string;
  title: string;
  summary: string;
  link?: string;
  publishedAt?: string;
  dateKey?: string;
  tags: string[];
  accent: 'amber' | 'green' | 'muted';
  importance?: NewsImportance;
  sentiment?: NewsSentiment;
};

type TimeframeOption = {
  label: '5D' | '1M' | '3M' | '1Y';
  days: number;
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
  private readonly marketDataService = inject(MarketDataService);
  private readonly newsDataService = inject(NewsDataService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly symbol = this.route.snapshot.paramMap.get('symbol');

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
  readonly detailRoute = this.symbol ? `/portfolio/${this.symbol}` : '/portfolio';
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', link: '/portfolio' },
    { label: 'Stock detail', link: this.detailRoute, active: true },
    { label: 'News Feed', link: '/portfolio' },
    { label: 'Settings', link: '/portfolio' },
  ];

  company = this.findCompany(this.symbol);

  quote: MarketQuote | null = null;
  chartData: MarketChartPoint[] = [];
  history: MarketHistoryPoint[] = [];
  hasChartData = false;
  isLoading = true;
  errorMessage = '';
  relatedNewsItems: RelatedNewsItem[] = [];
  selectedNewsItem: RelatedNewsItem | null = null;

  watchlistRows: WatchlistRow[] = [];

  ngOnInit(): void {
    this.loadWatchlist();
    this.loadMarketData();
    this.loadRelatedNews();
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
    const sector = this.findCompany(symbol)?.sector;

    if (!quote) {
      return { symbol, change: '—', direction: 'neutral', sector };
    }

    const change = quote.change ?? 0;
    const direction = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return { symbol, change: `${sign}${change.toFixed(1)}%`, direction, sector };
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

  selectTimeframe(timeframe: TimeframeOption): void {
    if (timeframe.label === this.activeTimeframe || !this.symbol) {
      return;
    }

    this.activeTimeframe = timeframe.label;
    this.loadMarketData(timeframe.days);
    this.loadRelatedNews(timeframe);
  }

  get absoluteChangeLabel(): string {
    if (!this.quote) {
      return '0.0%';
    }

    return `${Math.abs(this.quote.change).toFixed(1)}%`;
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
    return this.quote && this.quote.change < 0 ? 'negative' : 'positive';
  }

  private loadMarketData(days: number = this.getDaysForTimeframe(this.activeTimeframe)): void {
    const symbol = this.symbol;

    if (!symbol) {
      this.isLoading = false;
      this.errorMessage = 'No ticker was provided.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.marketDataService
      .getCompanyMarketData(symbol, days)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        timeout(10000),
        finalize(() => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          try {
            this.company = this.findCompany(response.ticker);
            this.quote = response.quote;
            this.chartData = this.normalizeChart(response.chart);
            this.history = this.normalizeHistory(response.history);
            this.buildChart();
            this.changeDetectorRef.markForCheck();
          } catch (error) {
            console.error('[company-detail] Error processing market response:', error);
            this.errorMessage = 'The backend responded, but the payload could not be processed.';
            this.changeDetectorRef.markForCheck();
          }
        },
        error: (error) => {
          console.error('[company-detail] Market request failed:', error);
          this.errorMessage = this.getMarketErrorMessage(error);
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  private loadRelatedNews(
    timeframe: TimeframeOption = this.getTimeframeOption(this.activeTimeframe),
  ): void {
    const symbol = this.symbol;

    if (!symbol) {
      this.relatedNewsItems = [];
      return;
    }

    this.newsDataService
      .getCompanyNews(symbol, this.company?.name, {
        // Scale with the window so longer timeframes get more dated markers
        // spread across the chart (the marker layer dedupes by day).
        limit: this.newsLimitForTimeframe(timeframe.days),
        range: timeframe.label,
        daysBack: timeframe.days,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.relatedNewsItems = response.items.map((item) => this.mapRelatedNewsItem(item));
          this.buildChart();
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.relatedNewsItems = [];
          this.buildChart();
          this.changeDetectorRef.markForCheck();
        },
      });
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

    if (data.length < 2 || !this.relatedNewsItems.length) {
      return [];
    }

    // Snap each article to the nearest chart point by its real publish date.
    const chosen = new Map<string, { item: RelatedNewsItem; rank: number; value: number }>();
    for (const item of this.relatedNewsItems) {
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
        return 3;
      case 'IMPORTANTE':
        return 2.2;
      case 'POCO_RELEVANTE':
        return 0.9;
      default:
        return 1.4;
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

  private getDaysForTimeframe(label: TimeframeOption['label']): number {
    return this.timeframeOptions.find((option) => option.label === label)?.days ?? 30;
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

  private normalizeChart(chart: unknown): MarketChartPoint[] {
    if (!Array.isArray(chart)) {
      return [];
    }

    return chart
      .map((point): MarketChartPoint | null => {
        if (!point || typeof point !== 'object') {
          return null;
        }

        const entry = point as Record<string, unknown>;
        const rawValue = entry['value'];
        const value =
          typeof rawValue === 'number'
            ? rawValue
            : typeof rawValue === 'string'
              ? Number(rawValue)
              : null;

        if (value === null || Number.isNaN(value)) {
          return null;
        }

        return {
          date: typeof entry['date'] === 'string' ? entry['date'] : String(entry['date'] ?? ''),
          value,
        };
      })
      .filter((point): point is MarketChartPoint => point !== null);
  }

  private normalizeHistory(history: unknown): MarketHistoryPoint[] {
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .map((point): MarketHistoryPoint | null => {
        if (!point || typeof point !== 'object') {
          return null;
        }

        const entry = point as Record<string, unknown>;
        const date = typeof entry['date'] === 'string' ? entry['date'] : String(entry['date'] ?? '');

        if (!date) {
          return null;
        }

        return {
          date,
          open: this.toNumber(entry['open']),
          high: this.toNumber(entry['high']),
          low: this.toNumber(entry['low']),
          close: this.toNumber(entry['close']),
          volume: this.toNumber(entry['volume']),
        };
      })
      .filter((point): point is MarketHistoryPoint => point !== null);
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
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
      source: item.source,
      age: this.formatRelativeDate(publishedAt),
      title: item.title,
      summary:
        item.aiSummary?.trim() ||
        item.summary?.trim() ||
        'No summary is available for this article yet.',
      link: item.link,
      publishedAt,
      dateKey: this.toDateKey(publishedAt),
      tags: this.buildNewsTags(item),
      accent: this.getNewsAccent(item),
      importance: item.importance,
      sentiment: item.sentiment,
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

    if (item.accent === 'green') {
      return 'positive';
    }

    if (item.accent === 'amber') {
      return 'negative';
    }

    return 'neutral';
  }

  private buildNewsTags(item: NewsItem): string[] {
    const tags = [
      item.language?.toUpperCase(),
      item.matchedTickers[0],
      item.score > 0 ? `score ${item.score}` : '',
    ].filter((value): value is string => Boolean(value));

    return tags.length ? tags.slice(0, 3) : ['headline'];
  }

  private getNewsAccent(item: NewsItem): RelatedNewsItem['accent'] {
    if (item.language === 'es') {
      return 'amber';
    }

    if (item.score >= 8) {
      return 'green';
    }

    return 'muted';
  }

  private formatRelativeDate(value?: string): string {
    if (!value) {
      return 'Latest';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Latest';
    }

    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
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
