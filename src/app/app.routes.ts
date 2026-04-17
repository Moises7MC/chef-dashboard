import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { KitchenOrdersComponent } from './components/kitchen/kitchen-orders.component';
import { authGuard, noAuthGuard } from './guards/auth.guard';
import { DashboardComponent } from './components/dashboard/dashboard';
import { HomeComponent } from './components/home/home';
import { UsersComponent } from './components/users/users';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [noAuthGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home',    component: HomeComponent },
      { path: 'kitchen', component: KitchenOrdersComponent },
      { path: 'users',   component: UsersComponent },
      { path: '',        redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  { path: '',   redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];