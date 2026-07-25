import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TimerSettings {
  warningMinutes: number;
  dangerMinutes: number;
}

// Valores usados mientras se carga la configuración real desde el backend
// (o si la carga falla) — antes estaban hardcodeados en cada pantalla.
const DEFAULT_TIMERS: TimerSettings = { warningMinutes: 8, dangerMinutes: 15 };

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly API = `${environment.apiUrl}/settings`;

  private timersSubject = new BehaviorSubject<TimerSettings>(DEFAULT_TIMERS);
  timers$ = this.timersSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadTimers();
  }

  get currentTimers(): TimerSettings {
    return this.timersSubject.value;
  }

  loadTimers(): void {
    this.http.get<TimerSettings>(`${this.API}/timers`).subscribe({
      next: (data) => this.timersSubject.next(data),
      error: () => { /* se mantienen los valores por defecto si falla */ }
    });
  }

  updateTimers(timers: TimerSettings) {
    return this.http.put<TimerSettings>(`${this.API}/timers`, timers);
  }
}
