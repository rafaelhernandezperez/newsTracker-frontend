import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANIES } from '../../core/data/companies.data';
import { Company } from '../../core/models/company.model';
import { CompanySelectorModalComponent } from './components/company-selector-modal/company-selector-modal';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, CompanySelectorModalComponent],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.css',
})
export class PortfolioComponent {
  isModalOpen = false;

  availableCompanies: Company[] = COMPANIES;

  selectedCompanies: Company[] = [];

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  addCompanies(companies: Company[]): void {
    this.selectedCompanies = [...companies];
    this.closeModal();
  }

  removeCompany(symbol: string): void {
    this.selectedCompanies = this.selectedCompanies.filter(
      company => company.symbol !== symbol
    );
  }
}
