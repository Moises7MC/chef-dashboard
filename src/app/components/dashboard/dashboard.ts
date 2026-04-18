import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {

  menuOpen = false;

  navItems = [
    {
      key: 'home',
      label: 'Home',
      route: '/dashboard/home',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
               <polyline points="9 22 9 12 15 12 15 22"/>
             </svg>`
    },
    {
      key: 'kitchen',
      label: 'Cocina',
      route: '/dashboard/kitchen',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M6 2v20M18 2v20M2 12h20M2 6h4M18 6h4M2 18h4M18 18h4"/>
             </svg>`
    },
    {
      key: 'users',
      label: 'Usuarios',
      route: '/dashboard/users',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
               <circle cx="9" cy="7" r="4"/>
               <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
               <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
             </svg>`
    },
    {
      key: 'menus',
      label: 'Menús',
      route: '/dashboard/menus',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
           <rect x="9" y="3" width="6" height="4" rx="1"/>
           <path d="M9 12h6M9 16h4"/>
         </svg>`
    },
    {
      key: 'caja',
      label: 'Caja',
      route: '/dashboard/caja',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <rect x="2" y="5" width="20" height="14" rx="2"/>
           <path d="M2 10h20"/>
         </svg>`
    }
  ];
  sidebarCollapsed: any;

  constructor(private auth: AuthService) { }

  logout(): void {
    this.auth.logout();
  }
}