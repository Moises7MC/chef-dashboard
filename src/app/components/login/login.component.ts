import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  username     = '';
  password     = '';
  showPassword = false;
  error        = '';
  loading      = false;

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
    history.pushState(null, '', window.location.href);
  }

  @HostListener('window:popstate')
  onPopState(): void {
    history.pushState(null, '', window.location.href);
  }

  onSubmit(): void {
    this.error = '';
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Completa todos los campos.';
      return;
    }
    this.loading = true;
    setTimeout(() => {
      const ok = this.auth.login(this.username.trim(), this.password);
      this.loading = false;
      if (ok) {
        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'Usuario o contraseña incorrectos.';
      }
    }, 500);
  }
}