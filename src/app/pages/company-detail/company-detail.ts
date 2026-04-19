import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { COMPANIES } from '../../core/data/companies.data';
import { Company } from '../../core/models/company.model';
import {
  MarketChartPoint,
  MarketHistoryPoint,
  MarketQuote,
} from '../../core/models/market.model';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsItem } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';

interface ChartMarker {
  x: number;
  y: number;
  size: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  item: RelatedNewsItem;
}

interface ChartAxisLabel {
  x: number;
  text: string;
}

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
export class CompanyDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketDataService = inject(MarketDataService);
  private readonly newsDataService = inject(NewsDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly symbol = this.route.snapshot.paramMap.get('symbol');

  readonly chartWidth = 860;
  readonly chartHeight = 340;
  readonly chartPadding = { top: 26, right: 24, bottom: 58, left: 24 };
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

  company =
    COMPANIES.find((item) => item.symbol === this.symbol) ?? this.createFallbackCompany(this.symbol);

  quote: MarketQuote | null = null;
  chartData: MarketChartPoint[] = [];
  history: MarketHistoryPoint[] = [];
  chartPath = '';
  chartAreaPath = '';
  newsMarkers: ChartMarker[] = [];
  gridLines: number[] = [];
  axisLabels: ChartAxisLabel[] = [];
  isLoading = true;
  errorMessage = '';
  relatedNewsItems: RelatedNewsItem[] = [];
  selectedNewsItem: RelatedNewsItem | null = null;

  readonly watchlistRows: WatchlistRow[] = [
    { symbol: 'NVDA', change: '+3.2%', direction: 'positive', sector: 'Tecnologia' },
    { symbol: 'BBVA', change: '+0.8%', direction: 'positive', sector: 'Banca' },
    { symbol: 'GOOG', change: '-1.1%', direction: 'negative', sector: 'Tecnologia' },
    { symbol: 'MSFT', change: '+0.4%', direction: 'positive', sector: 'Tecnologia' },
  ];

  ngOnInit(): void {
    this.loadMarketData();
    this.loadRelatedNews();
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
            this.company =
              COMPANIES.find((item) => item.symbol === response.ticker) ??
              this.createFallbackCompany(response.ticker);
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
        limit: Math.max(4, timeframe.days > 30 ? 8 : 6),
        range: timeframe.label,
        daysBack: timeframe.days,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.relatedNewsItems = response.items.length
            ? response.items.map((item) => this.mapRelatedNewsItem(item))
            : [this.createFallbackNewsItem(symbol)];
          this.buildChart();
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.relatedNewsItems = [this.createFallbackNewsItem(symbol)];
          this.buildChart();
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  private buildChart(): void {
    if (this.chartData.length < 2) {
      this.chartPath = '';
      this.chartAreaPath = '';
      this.newsMarkers = [];
      this.gridLines = [];
      this.axisLabels = [];
      return;
    }

    const prices = this.chartData.map((point) => point.value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(maxPrice - minPrice, 1);
    const innerWidth = this.chartWidth - this.chartPadding.left - this.chartPadding.right;
    const innerHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    const baselineY = this.chartHeight - this.chartPadding.bottom;

    const points = this.chartData.map((point, index) => {
      const x = this.chartPadding.left + (index / (this.chartData.length - 1)) * innerWidth;
      const y = this.chartPadding.top + ((maxPrice - point.value) / range) * innerHeight;

      return { x, y, price: point.value };
    });

    this.chartPath = points.map((point) => `${point.x},${point.y}`).join(' ');
    this.chartAreaPath = [
      `M ${points[0].x} ${baselineY}`,
      ...points.map((point) => `L ${point.x} ${point.y}`),
      `L ${points[points.length - 1].x} ${baselineY}`,
      'Z',
    ].join(' ');

    this.gridLines = [0.25, 0.5, 0.75].map(
      (ratio) => this.chartPadding.top + innerHeight * ratio,
    );
    this.axisLabels = this.buildAxisLabels(points.length);

    const groupedMarkers = new Map<string, number>();

    this.newsMarkers = this.relatedNewsItems
      .map((item) => {
        if (!item.dateKey) {
          return null;
        }

        const pointIndex = this.chartData.findIndex((point) => point.date === item.dateKey);

        if (pointIndex === -1) {
          return null;
        }

        const point = points[pointIndex];
        const stackedIndex = groupedMarkers.get(item.dateKey) ?? 0;
        groupedMarkers.set(item.dateKey, stackedIndex + 1);

        return {
          x: point.x,
          y: Math.max(this.chartPadding.top + 10, point.y - stackedIndex * 14),
          size: 6,
          sentiment: this.getMarkerSentiment(item),
          item,
        };
      })
      .filter((marker): marker is ChartMarker => marker !== null);
  }

  private buildAxisLabels(totalPoints: number): ChartAxisLabel[] {
    if (totalPoints < 2) {
      return [];
    }

    const tickCount = Math.min(4, totalPoints);
    const indexes = Array.from({ length: tickCount }, (_, index) =>
      Math.min(
        totalPoints - 1,
        Math.round((index / Math.max(tickCount - 1, 1)) * (totalPoints - 1)),
      ),
    );

    return [...new Set(indexes)].map((pointIndex) => ({
      x:
        this.chartPadding.left +
        (pointIndex / Math.max(totalPoints - 1, 1)) *
          (this.chartWidth - this.chartPadding.left - this.chartPadding.right),
      text: this.formatAxisDate(this.chartData[pointIndex]?.date ?? ''),
    }));
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
      summary: item.summary?.trim() || 'No summary is available for this article yet.',
      link: item.link,
      publishedAt,
      dateKey: this.toDateKey(publishedAt),
      tags: this.buildNewsTags(item),
      accent: this.getNewsAccent(item),
    };
  }

  private createFallbackNewsItem(symbol: string): RelatedNewsItem {
    return {
      source: 'NewsTracker',
      age: 'Latest',
      title: `Latest headlines continue to shape sentiment around ${symbol}`,
      summary: 'We could not find a matching article for the selected range yet.',
      tags: ['market reaction'],
      accent: 'muted',
    };
  }

  private getMarkerSentiment(item: RelatedNewsItem): ChartMarker['sentiment'] {
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

  private formatAxisDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(`${value}T00:00:00`);

    return new Intl.DateTimeFormat('en-US', {
      month: this.activeTimeframe === '1Y' ? 'short' : 'numeric',
      day: 'numeric',
    }).format(date);
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
