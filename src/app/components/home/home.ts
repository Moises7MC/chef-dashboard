import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="home-page">
      <div class="welcome-card">
        <div class="welcome-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h1>Bienvenido</h1>
        <p>Sistema de gestión — Como en Casa Restaurante</p>
      </div>
    </div>
  `,
  styles: [`
    .home-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f4f4f6;
      padding: 2rem;
    }
    .welcome-card {
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
    .welcome-icon svg {
      width: 64px;
      height: 64px;
      stroke: #f97316;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #111;
    }
    p {
      font-size: 15px;
      color: #888;
    }
  `]
})
export class HomeComponent {}