import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { CompanyDetailComponent } from './pages/company-detail/company-detail';
import { PortfolioComponent } from './pages/portfolio/portfolio';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [authGuard] },
  { path: 'portfolio/:symbol', component: CompanyDetailComponent, canActivate: [authGuard] },
];
