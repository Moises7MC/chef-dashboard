import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InventoryForm {
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number | null;
  notes: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.css']
})
export class InventoryComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/inventory`;

  items: InventoryItem[] = [];
  loading = false;
  error = '';
  success = '';
  searchTerm = '';

  showModal = false;
  isEditing = false;
  editingId: number | null = null;
  savingForm = false;

  categories = ['Carnes', 'Verduras', 'Abarrotes', 'Bebidas', 'Lácteos', 'Otros'];
  units = ['kg', 'g', 'l', 'ml', 'unidad', 'paquete'];

  form: InventoryForm = {
    name: '', category: 'Otros', unit: 'unidad',
    currentStock: 0, minStock: 0, unitCost: null, notes: ''
  };

  deleteConfirm: { id: number; name: string } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadItems();
  }

  get filteredItems(): InventoryItem[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.items;
    return this.items.filter(i =>
      i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term)
    );
  }

  get lowStockCount(): number {
    return this.items.filter(i => this.isLowStock(i)).length;
  }

  get totalValue(): number {
    return this.items.reduce((sum, i) => sum + (i.unitCost ? i.unitCost * i.currentStock : 0), 0);
  }

  isLowStock(item: InventoryItem): boolean {
    return item.currentStock <= item.minStock;
  }

  loadItems(): void {
    this.loading = true;
    this.error = '';
    this.http.get<InventoryItem[]>(this.API).subscribe({
      next: (data) => { this.items = data; this.loading = false; },
      error: () => {
        this.error = 'Error al cargar el inventario. Verifica que el backend esté corriendo.';
        this.loading = false;
      }
    });
  }

  openCreate(): void {
    this.isEditing = false;
    this.editingId = null;
    this.form = { name: '', category: 'Otros', unit: 'unidad', currentStock: 0, minStock: 0, unitCost: null, notes: '' };
    this.error = '';
    this.showModal = true;
  }

  openEdit(item: InventoryItem): void {
    this.isEditing = true;
    this.editingId = item.id;
    this.form = {
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      unitCost: item.unitCost,
      notes: item.notes || ''
    };
    this.error = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveItem(): void {
    if (!this.form.name.trim()) { this.error = 'El nombre es requerido'; return; }
    if (this.form.currentStock < 0 || this.form.minStock < 0) {
      this.error = 'El stock no puede ser negativo';
      return;
    }
    this.savingForm = true;
    this.error = '';

    const body = { ...this.form, notes: this.form.notes.trim() || null };

    const req = this.isEditing && this.editingId
      ? this.http.put(`${this.API}/${this.editingId}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => { this.showSuccess(this.isEditing ? 'Ítem actualizado' : 'Ítem agregado'); this.loadItems(); },
      error: (e) => { this.error = e.error || 'Error al guardar'; this.savingForm = false; }
    });
  }

  adjustStock(item: InventoryItem, delta: number): void {
    if (item.currentStock + delta < 0) return;
    this.http.put<InventoryItem>(`${this.API}/${item.id}/adjust-stock`, { delta }).subscribe({
      next: (updated) => {
        item.currentStock = updated.currentStock;
        item.updatedAt = updated.updatedAt;
      },
      error: () => { this.error = 'Error al ajustar el stock'; }
    });
  }

  confirmDelete(item: InventoryItem): void {
    this.deleteConfirm = { id: item.id, name: item.name };
  }

  executeDelete(): void {
    if (!this.deleteConfirm) return;
    const id = this.deleteConfirm.id;
    this.http.delete(`${this.API}/${id}`).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.id !== id);
        this.deleteConfirm = null;
        this.showSuccess('Ítem eliminado');
      },
      error: () => { this.error = 'No se puede eliminar este ítem'; this.deleteConfirm = null; }
    });
  }

  private showSuccess(msg: string): void {
    this.success = msg;
    this.showModal = false;
    this.savingForm = false;
    setTimeout(() => this.success = '', 3000);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
