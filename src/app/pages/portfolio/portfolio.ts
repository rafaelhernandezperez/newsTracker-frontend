import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { COMPANIES } from '../../core/data/companies.data';
import { Company } from '../../core/models/company.model';
import { MarketQuote } from '../../core/models/market.model';
import { NewsItem } from '../../core/models/news.model';
import { MarketDataService } from '../../core/services/market-data.service';
import { NewsDataService } from '../../core/services/news-data.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AuthService } from '../../core/services/auth.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { CompanySelectorModalComponent } from './components/company-selector-modal/company-selector-modal';

type NavItem = {
  label: string;
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
  publishedAt: string;
  accent: 'blue' | 'green' | 'amber' | 'violet';
  empty: boolean;
};

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, CompanySelectorModalComponent],
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

  isModalOpen = false;

  /** Loading flags so the sidebar/news areas don't flash the empty state on first load. */
  readonly isWatchlistLoading = signal(false);
  readonly isNewsLoading = signal(false);

  readonly availableCompanies: Company[] = COMPANIES;
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', active: true },
    { label: 'Sentiment Analysis' },
  ];

  selectedCompanies: Company[] = [];
  watchlistRows: WatchlistRow[] = [];
  newsCards: NewsCard[] = [];

  ngOnInit(): void {
    this.selectedCompanies = this.resolveCompanies();
    this.syncViewModels();
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
        this.newsDataService.getCompanyNews(company.symbol, company.name, { limit: 1 }).pipe(
          map((response) => this.mapNewsCard(company, response.items[0])),
          catchError(() => of(this.mapNewsCard(company, null))),
        ),
      ),
    )
      .pipe(
        finalize(() => this.isNewsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cards) => {
        this.newsCards = cards;
        this.changeDetectorRef.markForCheck();
      });
  }

  private mapNewsCard(company: Company, newsItem: NewsItem | null | undefined): NewsCard {
    if (!newsItem) {
      return {
        company,
        headline: '',
        snippet: '',
        publishedAt: '',
        accent: 'blue',
        empty: true,
      };
    }

    return {
      company,
      headline: newsItem.title,
      snippet: newsItem.aiSummary?.trim() || newsItem.summary?.trim() || '',
      publishedAt: this.formatNewsDate(newsItem.isoDate ?? newsItem.pubDate),
      accent: this.getAccentFromNews(newsItem),
      empty: false,
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

  private formatNewsDate(value?: string): string {
    if (!value) {
      return 'Latest update';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Latest update';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}
