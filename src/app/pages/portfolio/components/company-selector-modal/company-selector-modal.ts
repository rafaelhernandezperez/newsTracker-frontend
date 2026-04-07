import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Company } from '../../../../core/models/company.model';

@Component({
  selector: 'app-company-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-selector-modal.html',
  styleUrl: './company-selector-modal.css',
})
export class CompanySelectorModalComponent {
  @Input() companies: Company[] = [];
  @Input() selectedCompanies: Company[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() saveSelection = new EventEmitter<Company[]>();

  search = '';
  tempSelection: Company[] = [];

  ngOnInit(): void {
    this.tempSelection = [...this.selectedCompanies];
  }

  get filteredCompanies(): Company[] {
    const term = this.search.toLowerCase().trim();

    if (!term) return this.companies;

    return this.companies.filter(
      company =>
        company.symbol.toLowerCase().includes(term) ||
        company.name.toLowerCase().includes(term)
    );
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