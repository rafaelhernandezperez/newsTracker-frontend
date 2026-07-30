import { Company } from '../models/company.model';

/**
 * Curated catalogue. The editorial blurb for each symbol lives in
 * `core/i18n/translations.ts` (one per language) so the list itself stays
 * language-neutral — `LanguageService.companyBlurb()` resolves it for display.
 */
export const COMPANIES: Company[] = [
  {
    symbol: 'BBVA',
    name: 'Banco Bilbao Vizcaya Argentaria',
    sector: 'Banca',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Tecnologia',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Tecnologia',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Tecnologia',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    sector: 'Automocion',
  },
  {
    symbol: 'SAN',
    name: 'Banco Santander',
    sector: 'Banca',
  },
];
