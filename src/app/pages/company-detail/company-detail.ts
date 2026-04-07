import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { COMPANIES } from '../../core/data/companies.data';

@Component({
  selector: 'app-company-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './company-detail.html',
  styleUrl: './company-detail.css',
})
export class CompanyDetailComponent {
  private readonly route = inject(ActivatedRoute);

  readonly company =
    COMPANIES.find(
      item => item.symbol === this.route.snapshot.paramMap.get('symbol')
    ) ?? null;
}
