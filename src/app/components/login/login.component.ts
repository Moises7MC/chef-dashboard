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

  // ─── Cambiar contraseña ───
  showChangePassword = false;
  cpUsername = '';
  cpCurrentPassword = '';
  cpNewPassword = '';
  cpNewPasswordConfirm = '';
  cpError = '';
  cpSuccess = '';
  cpLoading = false;

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

  async onSubmit(): Promise<void> {
    this.error = '';
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Completa todos los campos.';
      return;
    }
    this.loading = true;
    const ok = await this.auth.login(this.username.trim(), this.password);
    this.loading = false;
    if (ok) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error = 'Usuario o contraseña incorrectos.';
    }
  }

  // ─── Cambiar contraseña ───
  openChangePassword(): void {
    this.cpUsername = this.username.trim();
    this.cpCurrentPassword = '';
    this.cpNewPassword = '';
    this.cpNewPasswordConfirm = '';
    this.cpError = '';
    this.cpSuccess = '';
    this.showChangePassword = true;
  }

  closeChangePassword(): void {
    this.showChangePassword = false;
  }

  submitChangePassword(): void {
    this.cpError = '';
    if (!this.cpUsername.trim() || !this.cpCurrentPassword.trim() || !this.cpNewPassword.trim()) {
      this.cpError = 'Completa todos los campos.';
      return;
    }
    if (this.cpNewPassword.length < 4) {
      this.cpError = 'La nueva contraseña debe tener al menos 4 caracteres.';
      return;
    }
    if (this.cpNewPassword !== this.cpNewPasswordConfirm) {
      this.cpError = 'Las contraseñas nuevas no coinciden.';
      return;
    }

    this.cpLoading = true;
    this.auth.changePassword(this.cpUsername.trim(), this.cpCurrentPassword, this.cpNewPassword).subscribe({
      next: () => {
        this.cpLoading = false;
        this.cpSuccess = '✓ Contraseña actualizada. Ya puedes iniciar sesión con la nueva.';
        this.cpCurrentPassword = '';
        this.cpNewPassword = '';
        this.cpNewPasswordConfirm = '';
      },
      error: (e) => {
        this.cpLoading = false;
        this.cpError = e.error || 'Usuario o contraseña actual incorrectos.';
      }
    });
  }
}
