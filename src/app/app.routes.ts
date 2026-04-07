import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { CompanyDetailComponent } from './pages/company-detail/company-detail';
import { PortfolioComponent } from './pages/portfolio/portfolio';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'portfolio/:symbol', component: CompanyDetailComponent },
];
