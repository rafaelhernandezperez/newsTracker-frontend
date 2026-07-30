import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { COMPANIES } from '../../core/data/companies.data';
import { newsHeadline, newsSummary } from '../../core/i18n/news-text';
import { TranslationKey } from '../../core/i18n/translations';
import { Company } from '../../core/models/company.model';
import { MarketQuote } from '../../core/models/market.model';
import { NewsItem } from '../../core/models/news.model';
import { LanguageService } from '../../core/services/language.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle';
import { CompanySelectorModalComponent } from './components/company-selector-modal/company-selector-modal';

type NavItem = {
  labelKey: TranslationKey;
  active?: boolean;
};

type WatchlistRow = {
  company: Company;
  change: string;
  changeDirection: 'positive' | 'negative' | 'neutral';
};

type NewsCard = {
  company: Company;
  headline: string;
  snippet: string;
  /** Direct link to the article, so the story is readable from the card. */
  link: string;
  publishedAt: string;
  accent: 'blue' | 'green' | 'amber' | 'violet';
  empty: boolean;
  /** Sort keys mirroring the backend digest ranking (importance → score → recency). */
  importanceRank: number;
  score: number;
  publishedMs: number;
};

/** Same scale the backend digest uses; unclassified items count as NEUTRO. */
const IMPORTANCE_RANK: Record<string, number> = {
  MUY_IMPORTANTE: 3,
  IMPORTANTE: 2,
  NEUTRO: 1,
  POCO_RELEVANTE: 0,
};

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, CompanySelectorModalComponent, LanguageToggleComponent],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.css',
})
export class PortfolioComponent implements OnInit {
  private readonly newsDataService = inject(NewsDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly auth = inject(AuthService);
  private readonly watchlist = inject(WatchlistService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  readonly i18n = inject(LanguageService);
  /** Language the cards on screen were fetched in; drives the refetch below. */
  private loadedLanguage = this.i18n.language();

  isModalOpen = false;

  /** Loading flags so the sidebar/news areas don't flash the empty state on first load. */
  readonly isWatchlistLoading = signal(false);
  readonly isNewsLoading = signal(false);

  readonly availableCompanies: Company[] = COMPANIES;
  readonly navItems: NavItem[] = [{ labelKey: 'nav.dashboard', active: true }];

  selectedCompanies: Company[] = [];
  watchlistRows: WatchlistRow[] = [];
  newsCards: NewsCard[] = [];

  constructor() {
    // Headlines and summaries are generated server-side in the requested
    // language, so a language switch has to refetch — re-rendering the cached
    // cards would leave the previous language's text on screen. Initialized to
    // the current language, so the first run here never duplicates ngOnInit.
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

  /**
   * Self-heal: if the server watchlist (what the alert schedulers read) is
   * empty but this browser has a local selection, push it up. Covers
   * selections saved while the backend was unreachable — without this, alerts
   * would silently never fire for the user. Never touches a non-empty server
   * list, so it can't clobber a watchlist managed from another device.
   */
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
      // Best-effort: the next visit retries.
    }
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  addCompanies(companies: Company[]): void {
    this.selectedCompanies = [...companies];
    this.preferences.setCompanies(companies);
    this.syncViewModels();
    this.closeModal();

    // Keep the server watchlist (used by the daily digest) in sync for signed-in
    // users. No-op when logged out — the interceptor simply sends no token.
    if (this.auth.isAuthenticated) {
      void this.watchlist.sync(companies);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  /** Followed companies from prefs, enriched from the catalogue when curated. */
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
    // Em-dash when the quote is missing or the backend reported no change.
    if (!quote || quote.change == null) {
      return { company, change: '—', changeDirection: 'neutral' };
    }

    const change = quote.change;
    const direction = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const sign = change > 0 ? '+' : '';

    return { company, change: `${sign}${change.toFixed(1)}%`, changeDirection: direction };
  }

  private loadNewsCards(companies: Company[]): void {
    if (!companies.length) {
      this.newsCards = [];
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.isNewsLoading.set(true);

    forkJoin(
      companies.map((company) =>
        // Small recent window (3 days, like the tracker) instead of limit 1:
        // "the newest item ever" is often a weak mention, while the pick below
        // surfaces the most meaningful recent story per company.
        this.newsDataService.getCompanyNews(company.symbol, company.name, { limit: 5, daysBack: 3 }).pipe(
          map((response) => this.mapNewsCard(company, this.pickMostMeaningful(response.items))),
          catchError(() => of(this.mapNewsCard(company, null))),
        ),
      ),
    )
      .pipe(
        finalize(() => this.isNewsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cards) => {
        // Most meaningful story first (importance, then relevance, then
        // recency — the same ranking the daily digest uses); companies with
        // no recent news sink to the bottom.
        this.newsCards = [...cards].sort(
          (a, b) =>
            b.importanceRank - a.importanceRank ||
            b.score - a.score ||
            b.publishedMs - a.publishedMs,
        );
        this.changeDetectorRef.markForCheck();
      });
  }

  /** Best story by the digest's ranking: importance, then score, then recency. */
  private pickMostMeaningful(items: NewsItem[]): NewsItem | undefined {
    return [...items].sort(
      (a, b) =>
        this.importanceRankOf(b) - this.importanceRankOf(a) ||
        b.score - a.score ||
        this.publishedMsOf(b) - this.publishedMsOf(a),
    )[0];
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
        accent: 'blue',
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
      accent: this.getAccentFromNews(newsItem),
      empty: false,
      importanceRank: this.importanceRankOf(newsItem),
      score: newsItem.score,
      publishedMs: this.publishedMsOf(newsItem),
    };
  }

  private getAccentFromNews(newsItem: NewsItem): NewsCard['accent'] {
    if (newsItem.language === 'es') {
      return 'amber';
    }

    if (newsItem.score >= 8) {
      return 'green';
    }

    if (newsItem.source.toLowerCase().includes('benzinga')) {
      return 'violet';
    }

    return 'blue';
  }
}
