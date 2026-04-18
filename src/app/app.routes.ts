import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./components/home/home').then(m => m.HomeComponent)
      },
      {
        path: 'kitchen',
        loadComponent: () => import('./components/kitchen/kitchen-orders.component').then(m => m.KitchenOrdersComponent)
      },
      {
        path: 'menus',
        loadComponent: () => import('./components/menus/menus').then(m => m.MenusComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./components/users/users').then(m => m.UsersComponent)
      }
    ]
  },
  { path: '**', redirectTo: '/login' }
];