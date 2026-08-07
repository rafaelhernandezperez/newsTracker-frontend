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
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { NewsImportance, NewsItem, NewsSentiment } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { CompanySelectorModalComponent } from '../../shared/components/company-selector-modal/company-selector-modal';
import { CurrencyToggleComponent } from '../../shared/components/currency-toggle/currency-toggle';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';

/**
 * The chart can't read CSS variables, so the two market colours are mirrored
 * here as raw channels. Keep them in step with --nt-quote-up / --nt-quote-down
 * in styles.css: the line, its markers and the watchlist must agree.
 */
const QUOTE_UP = '53, 224, 141';
const QUOTE_DOWN = '255, 87, 87';

type NavItem = {
  labelKey: TranslationKey;
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
  publishedAt?: string;
  dateKey?: string;
  tags: string[];
  accent: 'positive' | 'negative' | 'neutral';
  importance?: NewsImportance;
  sentiment?: NewsSentiment;
  /** Language of the ORIGINAL article — shown as a tag, never used to pick copy. */
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
  imports: [
    CommonModule,
    RouterLink,
    CompanySelectorModalComponent,
    CurrencyToggleComponent,
    LanguageToggleComponent,
  ],
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
  readonly i18n = inject(LanguageService);
  readonly currencyService = inject(CurrencyService);
  private readonly watchlist = inject(WatchlistService);
  /** Language the news on screen was fetched in; drives the refetch below. */
  private loadedLanguage = this.i18n.language();
  /** Current ticker; follows the route param so in-page navigation reloads data. */
  private symbol = this.route.snapshot.paramMap.get('symbol');
  /** Timeframe selections; switchMap cancels the in-flight requests on a new pick. */
  private readonly timeframe$ = new Subject<TimeframeOption>();
  /** Low-priority requests warming the service caches for likely next ranges. */
  private readonly prefetchSubscriptions = new Map<TimeframeOption['label'], Subscription>();

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
  activeTimeframe: TimeframeOption['label'] = '5D';
  isWatchlistOpen = false;
  /** The watchlist editor, opened from "Manage" without leaving this page. */
  isManageOpen = false;
  readonly availableCompanies: Company[] = COMPANIES;
  /** Selection handed to the editor; snapshotted when it opens. */
  managedCompanies: Company[] = [];
  get navItems(): NavItem[] {
    const detailRoute = this.symbol ? `/portfolio/${this.symbol}` : '/portfolio';

    return [
      { labelKey: 'nav.dashboard', link: '/portfolio' },
      { labelKey: 'nav.stockDetail', link: detailRoute, active: true },
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

  constructor() {
    // AI headlines and summaries are generated server-side in the requested
    // language, so switching language has to re-run the news requests for the
    // current timeframe. Initialized to the current language, so the first run
    // here never duplicates the initial load.
    effect(() => {
      const language = this.i18n.language();

      if (language === this.loadedLanguage) {
        return;
      }

      this.loadedLanguage = language;
      // The open article popup holds a copy of the previous language's text and
      // its item is about to be replaced, so dismiss it rather than leave stale
      // copy on screen.
      this.selectedNewsItem = null;

      if (this.symbol) {
        this.resetTimeframePrefetches();
        this.timeframe$.next(this.getTimeframeOption(this.activeTimeframe));
        this.prefetchNextTimeframe(this.activeTimeframe);
      }
    });

    // The series is plotted in the display currency, so a currency switch (or
    // the FX rate arriving) has to redraw it. Prices in the header and stat
    // cards are getters, which Angular re-evaluates on its own.
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

  openManage(): void {
    this.managedCompanies = this.followedCompanies();
    this.isManageOpen = true;
  }

  closeManage(): void {
    this.isManageOpen = false;
  }

  /** Companies currently followed, enriched from the catalogue when curated. */
  private followedCompanies(): Company[] {
    return this.preferences
      .companies()
      .map(
        (stored) =>
          this.availableCompanies.find((company) => company.symbol === stored.symbol) ?? stored,
      );
  }

  /** Save the edited selection and refresh the sidebar in place. */
  saveManagedCompanies(companies: Company[]): void {
    void this.watchlist.save(companies);
    this.closeManage();
    this.loadWatchlist();
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
    this.prefetchNextTimeframe(timeframe.label);
  }

  /**
   * Warm the exact service-cache keys the next likely selection will use.
   * A short delay gives the visible range priority; if the user clicks early,
   * their foreground subscription joins the same shared HTTP observables.
   */
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
          typeof this.quote?.trailingPE === 'number' ? `${this.quote.trailingPE.toFixed(2)}x` : '--',
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
      // Market data is normally much faster than AI-localized news. Apply it
      // immediately so prices, stats, and the chart render without waiting for
      // every translation request in the forkJoin below.
      tap((market) => this.applyMarketData(market)),
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

  /** Apply the fast market payload independently of slower localized news. */
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

  /** Add news and chart markers when localization finishes. */
  private applyTimeframeData({ chartNews, relatedNews }: TimeframeData): void {
    this.chartNewsItems = chartNews;
    this.relatedNewsItems = relatedNews;
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

  /** Create the TradingView Lightweight Charts instance once the container exists. */
  private createChart(): void {
    const container = this.chartContainer?.nativeElement;

    if (!container || this.chart) {
      return;
    }

    // Charted in the same hairlines and greys as the rest of the page, so the
    // plot reads as part of the grid rather than an embedded widget.
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

    // Convert here so the price axis reads in the same currency as the header
    // and the stat cards.
    const currency = this.quotedCurrency;
    const seriesData = [...this.chartData]
      .filter((point) => Boolean(point.date))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .reduce<{ time: string; value: number }[]>((acc, point) => {
        const value = this.currencyService.convert(point.value, currency).amount;
        const last = acc[acc.length - 1];
        // Collapse any duplicate dates (Lightweight Charts requires unique, ascending times).
        if (last && last.time === point.date) {
          last.value = value;
        } else {
          acc.push({ time: point.date, value });
        }
        return acc;
      }, []);

    // Green when the range closed above where it opened, red when it didn't —
    // the line answers the question before the axis does.
    const first = seriesData[0]?.value ?? 0;
    const last = seriesData[seriesData.length - 1]?.value ?? 0;
    this.series.applyOptions(this.seriesColors(last < first ? QUOTE_DOWN : QUOTE_UP));

    this.series.setData(seriesData);
    this.markersPlugin?.setMarkers(this.buildNewsMarkers(seriesData));
    this.chart?.timeScale().fitContent();
  }

  /** Line plus its fade, from one colour. */
  private seriesColors(rgb: string) {
    return {
      lineColor: `rgb(${rgb})`,
      topColor: `rgba(${rgb}, 0.22)`,
      bottomColor: `rgba(${rgb}, 0)`,
    };
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
    };
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
      this.importanceLabel(item.importance),
    ].filter((value): value is string => Boolean(value));

    return tags.length ? tags.slice(0, 3) : [this.i18n.t('news.tagHeadline')];
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

  /** Currency the backend quoted this company in. */
  private get quotedCurrency(): string {
    return this.quote?.currency ?? (this.company?.sector === 'Banca' ? 'EUR' : 'USD');
  }

  /**
   * True when prices are shown in their listing currency instead of the selected
   * one — no FX rate available, or a listing currency with no rate here (GBP,
   * JPY, ...). Suppressed while the rate is still loading, so a normal page load
   * doesn't flash a warning that resolves a moment later.
   */
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
