import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly KEY = 'cec_auth';
  private readonly API = `${environment.apiUrl}/settings`;

  constructor(private router: Router, private http: HttpClient) {}

  // ✅ Ahora valida contra el backend (RestaurantSettings) en vez de un
  //    usuario/contraseña hardcodeado en el frontend.
  async login(username: string, password: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.API}/login`, { username, password }));
      localStorage.setItem(this.KEY, 'true');
      return true;
    } catch {
      return false;
    }
  }

  changePassword(username: string, currentPassword: string, newPassword: string) {
    return this.http.put(`${this.API}/password`, { username, currentPassword, newPassword });
  }

  logout(): void {
    localStorage.removeItem(this.KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return localStorage.getItem(this.KEY) === 'true';
  }
}
