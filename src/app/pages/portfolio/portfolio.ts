import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  isModalOpen = false;

  readonly availableCompanies: Company[] = COMPANIES;
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', active: true },
    { label: 'Sentiment Analysis' },
    { label: 'News Feed' },
    { label: 'Settings' },
  ];
  topics: string[] = [];

  selectedCompanies: Company[] = [];
  watchlistRows: WatchlistRow[] = [];
  newsCards: NewsCard[] = [];

  ngOnInit(): void {
    this.selectedCompanies = this.resolveCompanies(this.preferences.tickers());
    this.topics = this.preferences.topics();
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
    const tickers = companies.map((company) => company.symbol);
    this.preferences.setTickers(tickers);
    this.syncViewModels();
    this.closeModal();

    // Keep the server watchlist (used by the daily digest) in sync for signed-in
    // users. No-op when logged out — the interceptor simply sends no token.
    if (this.auth.isAuthenticated) {
      void this.watchlist.sync(tickers);
    }
  }

  private resolveCompanies(tickers: string[]): Company[] {
    return tickers.map(
      (symbol) =>
        this.availableCompanies.find((company) => company.symbol === symbol) ?? { symbol, name: symbol },
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

    forkJoin(
      visible.map((company) =>
        this.marketDataService.getCompanyMarketData(company.symbol, 5).pipe(
          map((response) => this.mapWatchlistRow(company, response.quote)),
          catchError(() => of(this.mapWatchlistRow(company, null))),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.watchlistRows = rows;
        this.changeDetectorRef.markForCheck();
      });
  }

  private mapWatchlistRow(company: Company, quote: MarketQuote | null): WatchlistRow {
    if (!quote) {
      return { company, change: '—', changeDirection: 'neutral' };
    }

    const change = quote.change ?? 0;
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

    forkJoin(
      companies.map((company) =>
        this.newsDataService.getCompanyNews(company.symbol, company.name, { limit: 1 }).pipe(
          map((response) => this.mapNewsCard(company, response.items[0])),
          catchError(() => of(this.mapNewsCard(company, null))),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
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
      snippet: newsItem.summary?.trim() ?? '',
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
