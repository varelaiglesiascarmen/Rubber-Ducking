import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './features/dashboard/dashboard-layout/dashboard-layout';

export const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardLayoutComponent
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
