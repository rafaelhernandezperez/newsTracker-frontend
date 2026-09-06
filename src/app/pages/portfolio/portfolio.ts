import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  concat,
  filter,
  finalize,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
} from 'rxjs';
import { COMPANIES } from '../../core/data/companies.data';
import { newsHeadline, newsSummary } from '../../core/i18n/news-text';
import { Company } from '../../core/models/company.model';
import { MarketQuote } from '../../core/models/market.model';
import { NewsItem } from '../../core/models/news.model';
import { LanguageService } from '../../core/services/language.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { CompanySelectorModalComponent } from '../../shared/components/company-selector-modal/company-selector-modal';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';
import { SettingsModalComponent } from '../../shared/components/settings-modal/settings-modal';

type WatchlistRow = {
  company: Company;
  change: string;
  changeDirection: 'positive' | 'negative' | 'neutral';
};

type NewsCard = {
  company: Company;
  headline: string;
  snippet: string;

  link: string;
  publishedAt: string;
  empty: boolean;

  importanceRank: number;
  score: number;
  publishedMs: number;
};

/** Match the backend digest ranking; unclassified stories count as NEUTRO. */
const IMPORTANCE_RANK: Record<string, number> = {
  MUY_IMPORTANTE: 3,
  IMPORTANTE: 2,
  NEUTRO: 1,
  POCO_RELEVANTE: 0,
};

@Component({
  selector: 'app-portfolio',
  imports: [
    RouterLink,
    CompanySelectorModalComponent,
    LanguageToggleComponent,
    SettingsModalComponent,
  ],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.css',
})
export class PortfolioComponent implements OnInit {
  private readonly newsDataService = inject(NewsDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly auth = inject(AuthService);
  private readonly watchlist = inject(WatchlistService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  readonly i18n = inject(LanguageService);

  private loadedLanguage = this.i18n.language();

  private newsRequestId = 0;
  private newsLoadSubscription?: Subscription;

  isModalOpen = false;
  isSettingsOpen = false;

  readonly isWatchlistLoading = signal(false);
  readonly isNewsLoading = signal(false);

  readonly availableCompanies: Company[] = COMPANIES;

  selectedCompanies: Company[] = [];
  watchlistRows: WatchlistRow[] = [];
  newsCards: NewsCard[] = [];

  constructor() {
    // Refetch server-generated news when the language changes.
    effect(() => {
      const language = this.i18n.language();

      if (language === this.loadedLanguage) {
        return;
      }

      this.loadedLanguage = language;
      this.loadNewsCards(this.selectedCompanies);
    });
  }

  ngOnInit(): void {
    this.selectedCompanies = this.resolveCompanies();
    this.syncViewModels();
    void this.healServerWatchlist();
  }

  /** Restore an empty server watchlist from local preferences without replacing remote selections. */
  private async healServerWatchlist(): Promise<void> {
    if (!this.auth.isAuthenticated || !this.selectedCompanies.length) {
      return;
    }
    try {
      const server = await this.watchlist.fetch();
      if (server.length === 0) {
        await this.watchlist.sync(this.selectedCompanies);
      }
    } catch {
      // Retry on the next visit if the server is unavailable.
    }
  }

  openModal(): void {
    this.isSettingsOpen = false;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  openSettings(): void {
    this.isModalOpen = false;
    this.isSettingsOpen = true;
  }

  closeSettings(): void {
    this.isSettingsOpen = false;
  }

  addCompanies(companies: Company[]): void {
    this.selectedCompanies = [...companies];
    void this.watchlist.save(companies);
    this.syncViewModels();
    this.closeModal();
  }

  private resolveCompanies(): Company[] {
    return this.preferences
      .companies()
      .map(
        (stored) =>
          this.availableCompanies.find((company) => company.symbol === stored.symbol) ?? stored,
      );
  }

  private syncViewModels(): void {
    this.loadWatchlist(this.selectedCompanies);
    this.loadNewsCards(this.selectedCompanies);
  }

  private loadWatchlist(companies: Company[]): void {
    const visible = companies.slice(0, 6);

    if (!visible.length) {
      this.watchlistRows = [];
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.isWatchlistLoading.set(true);

    forkJoin(
      visible.map((company) =>
        this.marketDataService.getCompanyMarketData(company.symbol, 5).pipe(
          map((response) => this.mapWatchlistRow(company, response.quote)),
          catchError(() => of(this.mapWatchlistRow(company, null))),
        ),
      ),
    )
      .pipe(
        finalize(() => this.isWatchlistLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.watchlistRows = rows;
        this.changeDetectorRef.markForCheck();
      });
  }

  private mapWatchlistRow(company: Company, quote: MarketQuote | null): WatchlistRow {
    if (!quote || quote.change == null) {
      return { company, change: '—', changeDirection: 'neutral' };
    }

    const change = quote.change;
    const direction = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return { company, change: `${sign}${change.toFixed(1)}%`, changeDirection: direction };
  }

  private loadNewsCards(companies: Company[]): void {
    const requestId = ++this.newsRequestId;
    const requestedLanguage = this.i18n.language();
    this.newsLoadSubscription?.unsubscribe();

    if (!companies.length) {
      this.newsCards = [];
      this.isNewsLoading.set(false);
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.isNewsLoading.set(true);
    this.newsCards = [];

    // Show native-language RSS previews before requesting AI enrichment.
    const immediateCards$ = from(companies).pipe(
      mergeMap(
        (company) =>
          this.newsDataService
            .getCompanyNews(company.symbol, company.name, {
              limit: 1,
              daysBack: 3,
              rssOnly: true,
              enrich: false,
              sourceLanguage: requestedLanguage,
            })
            .pipe(
              map((response) =>
                response.items[0] ? this.mapNewsCard(company, response.items[0]) : null,
              ),
              filter((card): card is NewsCard => card !== null),
              catchError(() => EMPTY),
            ),
        6,
      ),
    );

    // Replace each preview with one translated and classified story.
    const enrichedCards$ = from(companies).pipe(
      mergeMap(
        (company) =>
          this.newsDataService
            .getCompanyNews(company.symbol, company.name, {
              limit: 1,
              daysBack: 3,
              rssOnly: true,
            })
            .pipe(
              map((response) => this.mapNewsCard(company, response.items[0])),
              catchError(() => of(this.mapNewsCard(company, null))),
            ),
        // Limit concurrent AI requests for larger watchlists.
        4,
      ),
    );

    this.newsLoadSubscription = concat(immediateCards$, enrichedCards$)
      .pipe(
        finalize(() => {
          if (requestId === this.newsRequestId) {
            this.isNewsLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((card) => {
        // Ignore results from an earlier language or watchlist selection.
        if (requestId !== this.newsRequestId) {
          return;
        }

        this.newsCards = [
          ...this.newsCards.filter((existing) => existing.company.symbol !== card.company.symbol),
          card,
        ].sort(
          (a, b) =>
            b.importanceRank - a.importanceRank ||
            b.score - a.score ||
            b.publishedMs - a.publishedMs,
        );
        this.changeDetectorRef.markForCheck();
      });
  }

  private importanceRankOf(item: NewsItem): number {
    return item.importance ? (IMPORTANCE_RANK[item.importance] ?? 1) : 1;
  }

  private publishedMsOf(item: NewsItem): number {
    const ms = Date.parse(item.isoDate ?? item.pubDate ?? '');
    return Number.isFinite(ms) ? ms : 0;
  }

  private mapNewsCard(company: Company, newsItem: NewsItem | null | undefined): NewsCard {
    if (!newsItem) {
      return {
        company,
        headline: '',
        snippet: '',
        link: '',
        publishedAt: '',
        empty: true,
        importanceRank: -1,
        score: 0,
        publishedMs: 0,
      };
    }

    return {
      company,
      headline: newsHeadline(newsItem),
      snippet: newsSummary(newsItem, this.i18n.language()),
      link: newsItem.link,
      publishedAt: this.i18n.formatLongDate(newsItem.isoDate ?? newsItem.pubDate),
      empty: false,
      importanceRank: this.importanceRankOf(newsItem),
      score: newsItem.score,
      publishedMs: this.publishedMsOf(newsItem),
    };
  }
}
