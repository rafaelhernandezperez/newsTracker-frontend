import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [loginGuard],
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./pages/portfolio/portfolio').then((m) => m.PortfolioComponent),
    canActivate: [authGuard],
  },
  {
    path: 'portfolio/:symbol',
    loadComponent: () =>
      import('./pages/company-detail/company-detail').then((m) => m.CompanyDetailComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'portfolio' },
];
