import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Waiter {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  gender: string;
  isActive: boolean;
  createdAt: string;
}

interface WaiterForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  gender: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './users.html',
  styleUrls: ['./users.css']
})
export class UsersComponent implements OnInit {

  // private readonly API = 'http://localhost:5245/api/waiter';
  private readonly API = 'https://app-restaurant-api.onrender.com/api/waiter';

  waiters: Waiter[] = [];
  loading = false;
  error = '';
  success = '';
  showModal = false;
  isEditing = false;
  editingId: number | null = null;
  savingForm = false;

  form: WaiterForm = {
    username: '', password: '', firstName: '', lastName: '', gender: 'M'
  };

  get activeCount(): number {
    return this.waiters.filter(w => w.isActive).length;
  }
  
  constructor(private http: HttpClient) { }

  ngOnInit(): void { this.loadWaiters(); }

  loadWaiters(): void {
    this.loading = true;
    this.error = '';
    this.http.get<Waiter[]>(this.API).subscribe({
      next: (data) => { this.waiters = data; this.loading = false; },
      error: () => {
        this.error = 'Error al cargar mozos. Verifica que el backend esté corriendo.';
        this.loading = false;
      }
    });
  }

  openCreate(): void {
    this.isEditing = false;
    this.editingId = null;
    this.form = { username: '', password: '', firstName: '', lastName: '', gender: 'M' };
    this.error = '';
    this.showModal = true;
  }

  openEdit(w: Waiter): void {
    this.isEditing = true;
    this.editingId = w.id;
    this.form = { username: w.username, password: '', firstName: w.firstName, lastName: w.lastName, gender: w.gender };
    this.error = '';
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  saveWaiter(): void {
    if (!this.form.username.trim() || !this.form.firstName.trim() || !this.form.lastName.trim()) {
      this.error = 'Usuario, nombre y apellido son requeridos'; return;
    }
    if (!this.isEditing && !this.form.password.trim()) {
      this.error = 'La contraseña es requerida'; return;
    }
    this.savingForm = true;
    this.error = '';

    if (this.isEditing && this.editingId) {
      const body = { ...this.form, isActive: true };
      this.http.put(`${this.API}/${this.editingId}`, body).subscribe({
        next: () => { this.showSuccess('Mozo actualizado'); this.loadWaiters(); },
        error: (e) => { this.error = e.error || 'Error al actualizar'; this.savingForm = false; }
      });
    } else {
      this.http.post<Waiter>(this.API, this.form).subscribe({
        next: () => { this.showSuccess('Mozo creado'); this.loadWaiters(); },
        error: (e) => { this.error = e.error || 'Error al crear'; this.savingForm = false; }
      });
    }
  }

  toggleActive(w: Waiter): void {
    this.http.put<any>(`${this.API}/${w.id}/toggle-active`, {}).subscribe({
      next: (res) => { w.isActive = res.isActive; this.showSuccess(w.isActive ? 'Mozo activado' : 'Mozo desactivado'); },
      error: () => this.error = 'Error al cambiar estado'
    });
  }

  deleteWaiter(w: Waiter): void {
    if (!confirm(`¿Eliminar a ${w.firstName} ${w.lastName}?`)) return;
    this.http.delete(`${this.API}/${w.id}`).subscribe({
      next: () => { this.waiters = this.waiters.filter(x => x.id !== w.id); this.showSuccess('Mozo eliminado'); },
      error: () => this.error = 'Error al eliminar'
    });
  }

  private showSuccess(msg: string): void {
    this.success = msg;
    this.showModal = false;
    this.savingForm = false;
    setTimeout(() => this.success = '', 3000);
  }

  getGenderIcon(gender: string): string { return gender === 'F' ? '👩' : '👨'; }

  getGenderLabel(gender: string): string { return gender === 'F' ? 'Moza' : 'Mozo'; }
  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}