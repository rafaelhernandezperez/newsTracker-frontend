import { HttpErrorResponse } from '@angular/common/http';
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
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  timer,
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
import { newsHeadline, newsSummary } from '../../core/i18n/news-text';
import { TranslationKey } from '../../core/i18n/translations';
import { Company } from '../../core/models/company.model';
import {
  MarketChartPoint,
  MarketHistoryPoint,
  MarketQuote,
  MarketResponse,
} from '../../core/models/market.model';
import { CurrencyService } from '../../core/services/currency.service';
import { LanguageService } from '../../core/services/language.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsImportance, NewsItem } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { CompanySelectorModalComponent } from '../../shared/components/company-selector-modal/company-selector-modal';
import { CurrencyToggleComponent } from '../../shared/components/currency-toggle/currency-toggle';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';
import { SettingsModalComponent } from '../../shared/components/settings-modal/settings-modal';

/** Keep these chart colors in sync with --nt-quote-up and --nt-quote-down in styles.css. */
const QUOTE_UP = '53, 224, 141';
const QUOTE_DOWN = '255, 87, 87';

const ADDITIONAL_NEWS_DISPLAY_LIMIT = 12;

type WatchlistRow = {
  symbol: string;
  name?: string;
  change: string;
  direction: 'positive' | 'negative' | 'neutral';
};

type StatCard = {
  labelKey: TranslationKey;
  value: string;
};

type RelatedNewsItem = {
  id: string;
  source: string;
  age: string;
  title: string;
  summary: string;
  link?: string;
  dateKey?: string;
  tags: string[];
  accent: 'positive' | 'negative' | 'neutral';
  importance?: NewsImportance;
};

type TimeframeOption = {
  label: '5D' | '1M' | '3M' | '1Y';
  days: number;
};

type TimeframeData = {
  market: { response: MarketResponse | null; error: string | null };
  chartNews: RelatedNewsItem[];
  relatedNews: RelatedNewsItem[];
};

type ChosenChartNews = {
  item: RelatedNewsItem;
  rank: number;
  value: number;
};

@Component({
  selector: 'app-company-detail',
  imports: [
    RouterLink,
    CompanySelectorModalComponent,
    CurrencyToggleComponent,
    LanguageToggleComponent,
    SettingsModalComponent,
  ],
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
  readonly i18n = inject(LanguageService);
  readonly currencyService = inject(CurrencyService);
  private readonly watchlist = inject(WatchlistService);

  private loadedLanguage = this.i18n.language();

  private symbol = this.route.snapshot.paramMap.get('symbol');

  private readonly timeframe$ = new Subject<TimeframeOption>();

  private readonly prefetchSubscriptions = new Map<TimeframeOption['label'], Subscription>();

  @ViewChild('chartContainer') private chartContainer?: ElementRef<HTMLDivElement>;
  private chart?: IChartApi;
  private series?: ISeriesApi<'Area'>;
  private markersPlugin?: ISeriesMarkersPluginApi<Time>;

  private markerLookup = new Map<string, RelatedNewsItem>();

  readonly timeframeOptions: TimeframeOption[] = [
    { label: '5D', days: 5 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '1Y', days: 365 },
  ];
  activeTimeframe: TimeframeOption['label'] = '5D';
  isWatchlistOpen = false;

  isManageOpen = false;
  isSettingsOpen = false;
  readonly availableCompanies: Company[] = COMPANIES;

  managedCompanies: Company[] = [];

  company = this.findCompany(this.symbol);

  quote: MarketQuote | null = null;
  chartData: MarketChartPoint[] = [];
  history: MarketHistoryPoint[] = [];
  hasChartData = false;
  isLoading = true;
  errorMessage = '';

  chartNewsItems: RelatedNewsItem[] = [];

  relatedNewsItems: RelatedNewsItem[] = [];
  selectedNewsItem: RelatedNewsItem | null = null;

  lastUpdatedAt: Date | null = null;

  watchlistRows: WatchlistRow[] = [];

  constructor() {
    // Refetch server-generated news when the language changes.
    effect(() => {
      const language = this.i18n.language();

      if (language === this.loadedLanguage) {
        return;
      }

      this.loadedLanguage = language;
      // Close the article before replacing its text with the newly selected language.
      this.selectedNewsItem = null;

      if (this.symbol) {
        this.resetTimeframePrefetches();
        this.timeframe$.next(this.getTimeframeOption(this.activeTimeframe));
        this.prefetchNextTimeframe(this.activeTimeframe);
      }
    });

    // Redraw converted prices when the display currency or exchange rate changes.
    effect(() => {
      this.currencyService.currency();
      this.currencyService.hasRate();
      this.buildChart();
      this.changeDetectorRef.markForCheck();
    });
  }

  ngOnInit(): void {
    this.loadWatchlist();

    this.timeframe$
      .pipe(
        switchMap((timeframe) => this.fetchTimeframeData(timeframe)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.applyTimeframeData(data));

    // Route changes reuse this component, so reload when the symbol changes.
    this.route.paramMap
      .pipe(
        map((params) => params.get('symbol')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((symbol) => this.onSymbolChange(symbol));
  }

  private onSymbolChange(symbol: string | null): void {
    this.resetTimeframePrefetches();
    this.symbol = symbol;
    this.company = this.findCompany(symbol);
    this.activeTimeframe = '5D';

    if (!symbol) {
      this.isLoading = false;
      this.errorMessage = this.i18n.t('market.noTicker');
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.quote = null;
    this.chartData = [];
    this.history = [];
    this.chartNewsItems = [];
    this.relatedNewsItems = [];
    this.selectedNewsItem = null;
    this.lastUpdatedAt = null;
    this.errorMessage = '';
    this.isWatchlistOpen = false;
    this.buildChart();

    this.timeframe$.next(this.getTimeframeOption(this.activeTimeframe));
    this.prefetchNextTimeframe(this.activeTimeframe);
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

    if (!quote || quote.change == null) {
      return { symbol, name, change: '—', direction: 'neutral' };
    }

    const change = quote.change;
    const direction = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return { symbol, name, change: `${sign}${change.toFixed(1)}%`, direction };
  }

  toggleWatchlist(): void {
    this.isWatchlistOpen = !this.isWatchlistOpen;
  }

  openManage(): void {
    this.isSettingsOpen = false;
    this.managedCompanies = this.followedCompanies();
    this.isManageOpen = true;
  }

  closeManage(): void {
    this.isManageOpen = false;
  }

  openSettings(): void {
    this.isManageOpen = false;
    this.selectedNewsItem = null;
    this.isSettingsOpen = true;
  }

  closeSettings(): void {
    this.isSettingsOpen = false;
  }

  private followedCompanies(): Company[] {
    return this.preferences
      .companies()
      .map(
        (stored) =>
          this.availableCompanies.find((company) => company.symbol === stored.symbol) ?? stored,
      );
  }

  saveManagedCompanies(companies: Company[]): void {
    void this.watchlist.save(companies);
    this.closeManage();
    this.loadWatchlist();
  }

  openNewsModal(item: RelatedNewsItem): void {
    this.isSettingsOpen = false;
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

  selectTimeframe(timeframe: TimeframeOption): void {
    if (timeframe.label === this.activeTimeframe || !this.symbol) {
      return;
    }

    this.activeTimeframe = timeframe.label;
    this.timeframe$.next(timeframe);
    this.prefetchNextTimeframe(timeframe.label);
  }

  /** Delay prefetching so the visible timeframe takes priority. */
  private prefetchNextTimeframe(current: TimeframeOption['label']): void {
    const nextLabel = current === '5D' ? '1M' : current === '1M' ? '3M' : null;
    if (!nextLabel || !this.symbol || this.prefetchSubscriptions.has(nextLabel)) {
      return;
    }

    const symbol = this.symbol;
    const companyName = this.company?.name;
    const timeframe = this.getTimeframeOption(nextLabel);
    const subscription = timer(600)
      .pipe(
        switchMap(() =>
          forkJoin({
            market: this.marketDataService.getCompanyMarketData(symbol, timeframe.days),
            news: this.newsDataService.getCompanyNews(symbol, companyName, {
              limit: this.newsLimitForTimeframe(timeframe.days),
              range: timeframe.label,
              daysBack: timeframe.days,
            }),
          }),
        ),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.prefetchSubscriptions.set(nextLabel, subscription);
  }

  private resetTimeframePrefetches(): void {
    for (const subscription of this.prefetchSubscriptions.values()) {
      subscription.unsubscribe();
    }
    this.prefetchSubscriptions.clear();
  }

  get absoluteChangeLabel(): string {
    if (this.quote?.change == null) {
      return '—';
    }

    return `${Math.abs(this.quote.change).toFixed(1)}%`;
  }

  get lastUpdatedLabel(): string {
    return this.i18n.formatTime(this.lastUpdatedAt);
  }

  get statCards(): StatCard[] {
    const latestPoint = this.history.at(-1);
    const fallbackValue = this.quote?.price ?? latestPoint?.close ?? null;

    return [
      {
        labelKey: 'stat.open',
        value: this.formatCurrency(this.quote?.open ?? latestPoint?.open ?? null, fallbackValue),
      },
      {
        labelKey: 'stat.dayHigh',
        value: this.formatCurrency(
          this.quote?.dayHigh ?? this.getHistoryExtreme('high', 'max'),
          fallbackValue,
        ),
      },
      {
        labelKey: 'stat.dayLow',
        value: this.formatCurrency(
          this.quote?.dayLow ?? this.getHistoryExtreme('low', 'min'),
          fallbackValue,
        ),
      },
      {
        labelKey: 'stat.volume',
        value: this.formatCompactNumber(this.quote?.volume ?? latestPoint?.volume ?? null),
      },
      {
        labelKey: 'stat.week52High',
        value: this.formatCurrency(
          this.quote?.fiftyTwoWeekHigh ?? this.getHistoryExtreme('high', 'max'),
          fallbackValue,
        ),
      },
      {
        labelKey: 'stat.week52Low',
        value: this.formatCurrency(
          this.quote?.fiftyTwoWeekLow ?? this.getHistoryExtreme('low', 'min'),
          fallbackValue,
        ),
      },
      {
        labelKey: 'stat.peRatio',
        value:
          typeof this.quote?.trailingPE === 'number'
            ? `${this.quote.trailingPE.toFixed(2)}x`
            : '--',
      },
      {
        labelKey: 'stat.marketCap',
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
      // Render market data without waiting for news translation.
      tap((market) => this.applyMarketData(market)),
    );

    const chartNews$ = this.newsDataService
      .getCompanyNews(symbol, this.company?.name, {
        limit: this.newsLimitForTimeframe(timeframe.days),
        range: timeframe.label,
        daysBack: timeframe.days,
      })
      .pipe(
        map((response) => response.items.map((item) => this.mapRelatedNewsItem(item))),
        catchError(() => of([] as RelatedNewsItem[])),
      );

    // The 5D list shows today’s news; longer timeframes share the chart’s full range.
    const relatedNews$ =
      timeframe.label === '5D'
        ? this.newsDataService
            .getCompanyNews(symbol, this.company?.name, {
              // Allow extra candidates because chart stories are excluded from this list.
              limit: ADDITIONAL_NEWS_DISPLAY_LIMIT + 4,
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

  private applyMarketData(market: TimeframeData['market']): void {
    this.isLoading = false;

    if (market.response) {
      try {
        this.company = this.findCompany(market.response.ticker);
        this.quote = market.response.quote;
        this.chartData = market.response.chart;
        this.history = market.response.history;
        this.lastUpdatedAt = new Date();
      } catch (error) {
        console.error('[company-detail] Error processing market response:', error);
        this.errorMessage = this.i18n.t('market.payloadError');
      }
    } else {
      this.errorMessage = market.error ?? this.i18n.t('market.failed');
    }

    this.buildChart();
    this.changeDetectorRef.markForCheck();
  }

  private applyTimeframeData({ chartNews, relatedNews }: TimeframeData): void {
    this.chartNewsItems = chartNews;
    this.relatedNewsItems = this.excludeChartNews(relatedNews);
    this.buildChart();
    this.changeDetectorRef.markForCheck();
  }

  ngAfterViewInit(): void {
    this.createChart();
    this.buildChart();
  }

  ngOnDestroy(): void {
    this.resetTimeframePrefetches();
    this.markersPlugin = undefined;
    this.series = undefined;
    this.chart?.remove();
    this.chart = undefined;
  }

  private createChart(): void {
    const container = this.chartContainer?.nativeElement;

    if (!container || this.chart) {
      return;
    }

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.32)',
        fontSize: 10,
        fontFamily: getComputedStyle(container).fontFamily,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255, 255, 255, 0.07)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(255, 255, 255, 0.35)', width: 1, style: 0, labelVisible: false },
        horzLine: { color: 'rgba(255, 255, 255, 0.35)', width: 1, style: 0 },
      },
    });

    this.series = this.chart.addSeries(AreaSeries, {
      ...this.seriesColors(QUOTE_UP),
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerBorderColor: '#000',
      crosshairMarkerBackgroundColor: '#fff',
    });

    this.markersPlugin = createSeriesMarkers(this.series, []);

    // Resolve chart clicks to the news marker at the selected time.
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

    const seriesData = this.getChartSeriesData();

    const first = seriesData[0]?.value ?? 0;
    const last = seriesData[seriesData.length - 1]?.value ?? 0;
    this.series.applyOptions(this.seriesColors(last < first ? QUOTE_DOWN : QUOTE_UP));

    this.series.setData(seriesData);
    this.markersPlugin?.setMarkers(this.buildNewsMarkers(seriesData));
    this.chart?.timeScale().fitContent();
  }

  private seriesColors(rgb: string) {
    return {
      lineColor: `rgb(${rgb})`,
      topColor: `rgba(${rgb}, 0.22)`,
      bottomColor: `rgba(${rgb}, 0)`,
    };
  }

  private buildNewsMarkers(data: { time: string; value: number }[]): SeriesMarker<Time>[] {
    this.markerLookup.clear();

    if (data.length < 2 || !this.chartNewsItems.length) {
      return [];
    }

    const chosen = this.chooseChartNews(data);

    // Lightweight Charts requires markers in ascending time order.
    return [...chosen.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([time, { item, value }]) => {
        this.markerLookup.set(time, item);

        return {
          time,
          position: 'atPriceMiddle',
          price: value,
          shape: 'circle',
          color: this.sentimentColor(item.accent),
          size: this.importanceSize(item.importance),
        } satisfies SeriesMarker<Time>;
      });
  }

  /** Pick at most one story per chart day: the one with the highest importance. */
  private chooseChartNews(data: { time: string; value: number }[]): Map<string, ChosenChartNews> {
    const chosen = new Map<string, ChosenChartNews>();

    if (data.length < 2) {
      return chosen;
    }

    for (const item of this.chartNewsItems) {
      if (!item.dateKey) {
        continue;
      }

      // Map weekend and holiday stories to a trading day within four days.
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

    return chosen;
  }

  private excludeChartNews(items: RelatedNewsItem[]): RelatedNewsItem[] {
    const represented = new Set<string>();

    for (const { item } of this.chooseChartNews(this.getChartSeriesData()).values()) {
      for (const key of this.newsIdentityKeys(item)) {
        represented.add(key);
      }
    }

    return items
      .filter((item) => !this.newsIdentityKeys(item).some((key) => represented.has(key)))
      .slice(0, ADDITIONAL_NEWS_DISPLAY_LIMIT);
  }

  /** Match by URL as well as ID because some feeds regenerate article IDs. */
  private newsIdentityKeys(item: RelatedNewsItem): string[] {
    const keys = [`id:${item.id}`];
    const link = item.link?.trim().replace(/\/+$/, '');

    if (link) {
      keys.push(`link:${link}`);
    }

    return keys;
  }

  private getChartSeriesData(): { time: string; value: number }[] {
    const currency = this.quotedCurrency;

    return [...this.chartData]
      .filter((point) => Boolean(point.date))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .reduce<{ time: string; value: number }[]>((acc, point) => {
        const value = this.currencyService.convert(point.value, currency).amount;
        const last = acc[acc.length - 1];
        // Lightweight Charts requires unique, ascending times.
        if (last && last.time === point.date) {
          last.value = value;
        } else {
          acc.push({ time: point.date, value });
        }
        return acc;
      }, []);
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
      return `rgb(${QUOTE_UP})`;
    }

    if (sentiment === 'negative') {
      return `rgb(${QUOTE_DOWN})`;
    }

    return 'rgba(255, 255, 255, 0.55)';
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
      return 16;
    }
    if (days <= 30) {
      return 40;
    }
    if (days <= 90) {
      return 80;
    }
    return 120;
  }

  private localTodayDateKey(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTimeframeOption(label: TimeframeOption['label']): TimeframeOption {
    return (
      this.timeframeOptions.find((option) => option.label === label) ?? this.timeframeOptions[1]
    );
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

  private findCompany(symbol: string | null): Company | null {
    if (!symbol) {
      return null;
    }

    const upper = symbol.toUpperCase();
    return (
      COMPANIES.find((item) => item.symbol === upper) ??
      this.preferences.companies().find((item) => item.symbol === upper) ?? {
        symbol: upper,
        name: upper,
      }
    );
  }

  private getMarketErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return this.i18n.t('market.timeout');
    }

    if (error.status === 0) {
      return this.i18n.t('market.unreachable');
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return this.i18n.t('market.failedWithStatus', { status: error.status });
  }

  private mapRelatedNewsItem(item: NewsItem): RelatedNewsItem {
    const publishedAt = item.isoDate ?? item.pubDate;

    return {
      id: item.id,
      source: item.source,
      age: this.i18n.formatRelativeAge(publishedAt),
      title: newsHeadline(item),
      summary: newsSummary(item, this.i18n.language()),
      link: item.link,
      dateKey: this.toDateKey(publishedAt),
      tags: this.buildNewsTags(item),
      accent: this.getNewsAccent(item),
      importance: item.importance,
    };
  }

  private buildNewsTags(item: NewsItem): string[] {
    return [
      item.language?.toUpperCase(),
      item.matchedTickers[0],
      this.importanceLabel(item.importance),
    ].filter((value): value is string => Boolean(value));
  }

  private importanceLabel(importance?: NewsImportance): string {
    switch (importance) {
      case 'MUY_IMPORTANTE':
        return this.i18n.t('importance.veryImportant');
      case 'IMPORTANTE':
        return this.i18n.t('importance.important');
      case 'POCO_RELEVANTE':
        return this.i18n.t('importance.lowRelevance');
      case 'NEUTRO':
        return this.i18n.t('importance.neutral');
      default:
        return this.i18n.t('importance.pending');
    }
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

  private get quotedCurrency(): string {
    return this.quote?.currency ?? (this.company?.sector === 'Banca' ? 'EUR' : 'USD');
  }

  /** Show the native-currency fallback only after the rate request finishes. */
  get showsQuotedCurrencyNote(): boolean {
    if (this.currencyService.isRateLoading()) {
      return false;
    }

    return (
      this.currencyService.convert(1, this.quotedCurrency).currency !==
      this.currencyService.currency()
    );
  }

  private formatCurrency(value: number | null | undefined, fallbackValue?: number | null): string {
    const amount = typeof value === 'number' ? value : fallbackValue;

    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return '--';
    }

    const converted = this.currencyService.convert(amount, this.quotedCurrency);

    return new Intl.NumberFormat(this.i18n.locale(), {
      style: 'currency',
      currency: converted.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted.amount);
  }

  private formatCompactCurrency(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '--';
    }

    const converted = this.currencyService.convert(value, this.quotedCurrency);

    return new Intl.NumberFormat(this.i18n.locale(), {
      style: 'currency',
      currency: converted.currency,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(converted.amount);
  }

  private formatCompactNumber(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '--';
    }

    return new Intl.NumberFormat(this.i18n.locale(), {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
