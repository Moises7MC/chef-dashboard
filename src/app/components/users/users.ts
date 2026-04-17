import { Component } from '@angular/core';

@Component({
  selector: 'app-users',
  standalone: true,
  template: `
    <div class="users-page">
      <div class="placeholder-card">
        <div class="placeholder-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2>Usuarios</h2>
        <p>Próximamente — gestión de usuarios del sistema</p>
      </div>
    </div>
  `,
  styles: [`
    .users-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f4f4f6;
      padding: 2rem;
    }
    .placeholder-card {
      background: #fff;
      border-radius: 16px;
      padding: 3rem 4rem;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.07);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .placeholder-icon svg {
      width: 64px;
      height: 64px;
      stroke: #f97316;
    }
    h2 {
      font-size: 24px;
      font-weight: 700;
      color: #111;
    }
    p {
      font-size: 14px;
      color: #aaa;
    }
  `]
})
export class UsersComponent {}