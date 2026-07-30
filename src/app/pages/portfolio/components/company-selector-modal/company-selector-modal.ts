import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { Company } from '../../../../core/models/company.model';
import { LanguageService } from '../../../../core/services/language.service';
import { TickerSearchService } from '../../../../core/services/ticker-search.service';

@Component({
  selector: 'app-company-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-selector-modal.html',
  styleUrl: './company-selector-modal.css',
})
export class CompanySelectorModalComponent implements OnInit {
  @Input() companies: Company[] = [];
  @Input() selectedCompanies: Company[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() saveSelection = new EventEmitter<Company[]>();

  private readonly tickerSearch = inject(TickerSearchService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(LanguageService);
  private readonly searchTerms = new Subject<string>();

  search = '';
  tempSelection: Company[] = [];
  /** Live results from the ticker search API for the current term. */
  remoteResults: Company[] = [];
  isSearching = false;

  ngOnInit(): void {
    this.tempSelection = [...this.selectedCompanies];

    this.searchTerms
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => (this.isSearching = term.trim().length >= 2)),
        switchMap((term) =>
          term.trim().length >= 2
            ? this.tickerSearch.search(term.trim()).pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        this.remoteResults = results;
        this.isSearching = false;
      });
  }

  onSearchChange(term: string): void {
    this.searchTerms.next(term);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  /**
   * Curated companies matching the term, previously added custom companies, and
   * live search results for anything else listed — deduped by symbol.
   */
  get filteredCompanies(): Company[] {
    const term = this.search.toLowerCase().trim();

    const curated = term
      ? this.companies.filter(
          (company) =>
            company.symbol.toLowerCase().includes(term) || company.name.toLowerCase().includes(term),
        )
      : this.companies;

    const merged = new Map<string, Company>();
    for (const company of curated) {
      merged.set(company.symbol, company);
    }
    // Keep the user's non-curated picks visible when not searching.
    if (!term) {
      for (const company of this.tempSelection) {
        if (!merged.has(company.symbol)) merged.set(company.symbol, company);
      }
    }
    for (const company of this.remoteResults) {
      if (term && !merged.has(company.symbol)) merged.set(company.symbol, company);
    }

    return [...merged.values()];
  }

  get showNoResults(): boolean {
    return this.search.trim().length >= 2 && !this.isSearching && this.filteredCompanies.length === 0;
  }

  isChecked(company: Company): boolean {
    return this.tempSelection.some(item => item.symbol === company.symbol);
  }

  toggleCompany(company: Company): void {
    const exists = this.tempSelection.some(item => item.symbol === company.symbol);

    if (exists) {
      this.tempSelection = this.tempSelection.filter(
        item => item.symbol !== company.symbol
      );
    } else {
      this.tempSelection = [...this.tempSelection, company];
    }
  }

  save(): void {
    this.saveSelection.emit(this.tempSelection);
  }
}
