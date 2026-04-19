import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { COMPANIES } from '../../core/data/companies.data';
import { Company } from '../../core/models/company.model';
import { NewsItem } from '../../core/models/news.model';
import { NewsDataService } from '../../core/services/news-data.service';
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
  readonly topics = ['AI & chips', 'Regulation'];

  selectedCompanies: Company[] = this.availableCompanies.filter((company) =>
    ['NVDA', 'BBVA', 'AAPL', 'MSFT'].includes(company.symbol),
  );
  watchlistRows: WatchlistRow[] = [];
  newsCards: NewsCard[] = [];

  ngOnInit(): void {
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
    this.syncViewModels();
    this.closeModal();
  }

  private syncViewModels(): void {
    this.watchlistRows = this.buildWatchlistRows(this.selectedCompanies);
    this.loadNewsCards(this.selectedCompanies);
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

  private buildWatchlistRows(companies: Company[]): WatchlistRow[] {
    const marketData: Record<string, Omit<WatchlistRow, 'company'>> = {
      NVDA: { change: '+3.2%', changeDirection: 'positive' },
      BBVA: { change: '+0.8%', changeDirection: 'positive' },
      AAPL: { change: '-1.1%', changeDirection: 'negative' },
      MSFT: { change: '+0.4%', changeDirection: 'positive' },
      GOOG: { change: '-0.6%', changeDirection: 'negative' },
      TSLA: { change: '+1.4%', changeDirection: 'positive' },
      SAN: { change: '+0.5%', changeDirection: 'positive' },
    };

    return companies.slice(0, 6).map((company) => ({
      company,
      ...(marketData[company.symbol] ?? {
        change: '0.0%',
        changeDirection: 'neutral' as const,
      }),
    }));
  }

  private mapNewsCard(company: Company, newsItem: NewsItem | null | undefined): NewsCard {
    if (!newsItem) {
      return {
        company,
        headline: `Latest story on ${company.name}`,
        snippet: company.summary ?? 'A concise summary of the latest company news will appear here.',
        publishedAt: company.publishedAt ?? 'Latest update',
        accent: 'blue',
      };
    }

    return {
      company,
      headline: newsItem.title,
      snippet: newsItem.summary?.trim() || company.summary || 'No summary available.',
      publishedAt: this.formatNewsDate(newsItem.isoDate ?? newsItem.pubDate),
      accent: this.getAccentFromNews(newsItem),
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
