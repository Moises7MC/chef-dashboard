import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { KitchenOrdersComponent } from './components/kitchen/kitchen-orders.component';
import { authGuard, noAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login',   component: LoginComponent,          canActivate: [noAuthGuard] },
  { path: 'kitchen', component: KitchenOrdersComponent,  canActivate: [authGuard]   },
  { path: '',        redirectTo: 'kitchen', pathMatch: 'full' },
  { path: '**',      redirectTo: 'kitchen' }
];