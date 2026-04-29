import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Summary {
  totalOrders: number;
  totalIngresos: number;
  totalPlatos: number;
  ticketPromedio: number;
  platoEstrella: string;
  platoEstrellaCantidad: number;
}

interface CategoryReport {
  categoryId: number;
  categoryName: string;
  quantity: number;
  total: number;
  percentage: number;
}

interface ProductReport {
  productId: number;
  productName: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

interface WaiterReport {
  waiterName: string;
  ordersCount: number;
  totalPlatos: number;
  total: number;
}

interface HourReport {
  hour: number;
  label: string;
  ordersCount: number;
  totalPlatos: number;
  total: number;
}

type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  // ── Filtros ─────────────────────────────────────────────
  selectedRange: DateRangePreset = 'today';
  customFrom = '';
  customTo = '';

  fromDate = '';
  toDate = '';

  // ── Datos ───────────────────────────────────────────────
  summary: Summary = {
    totalOrders: 0,
    totalIngresos: 0,
    totalPlatos: 0,
    ticketPromedio: 0,
    platoEstrella: '—',
    platoEstrellaCantidad: 0
  };
  categories: CategoryReport[] = [];
  products: ProductReport[] = [];
  waiters: WaiterReport[] = [];
  hours: HourReport[] = [];

  // ── UI ──────────────────────────────────────────────────
  activeTab: 'category' | 'product' | 'waiter' | 'hour' = 'category';
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.applyPreset('today');
  }

  // ═══════════════════════════════════════════════════════
  // Filtros de fecha
  // ═══════════════════════════════════════════════════════

  applyPreset(preset: DateRangePreset) {
    this.selectedRange = preset;
    const now = new Date();
    const today = this.toIsoDate(now);

    switch (preset) {
      case 'today':
        this.fromDate = today;
        this.toDate = today;
        break;

      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yIso = this.toIsoDate(yesterday);
        this.fromDate = yIso;
        this.toDate = yIso;
        break;

      case 'thisWeek':
        // Lunes hasta hoy
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1; // domingo=0, queremos lunes
        const monday = new Date(now);
        monday.setDate(now.getDate() - diff);
        this.fromDate = this.toIsoDate(monday);
        this.toDate = today;
        break;

      case 'thisMonth':
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        this.fromDate = this.toIsoDate(firstDay);
        this.toDate = today;
        break;

      case 'custom':
        if (!this.customFrom) this.customFrom = today;
        if (!this.customTo) this.customTo = today;
        this.fromDate = this.customFrom;
        this.toDate = this.customTo;
        break;
    }

    if (preset !== 'custom') {
      this.loadAll();
    }
  }

  applyCustomRange() {
    if (!this.customFrom || !this.customTo) return;
    if (this.customFrom > this.customTo) {
      alert('La fecha inicial debe ser anterior a la final');
      return;
    }
    this.fromDate = this.customFrom;
    this.toDate = this.customTo;
    this.loadAll();
  }

  private toIsoDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ═══════════════════════════════════════════════════════
  // Cargar datos
  // ═══════════════════════════════════════════════════════

  loadAll() {
    this.loading = true;
    const params = new HttpParams()
      .set('from', this.fromDate)
      .set('to', this.toDate);

    Promise.all([
      this.http.get<Summary>(`${this.apiUrl}/reports/summary`, { params }).toPromise(),
      this.http.get<CategoryReport[]>(`${this.apiUrl}/reports/by-category`, { params }).toPromise(),
      this.http.get<ProductReport[]>(`${this.apiUrl}/reports/by-product`, { params }).toPromise(),
      this.http.get<WaiterReport[]>(`${this.apiUrl}/reports/by-waiter`, { params }).toPromise(),
      this.http.get<HourReport[]>(`${this.apiUrl}/reports/by-hour`, { params }).toPromise(),
    ]).then(([summary, categories, products, waiters, hours]) => {
      this.summary = summary || this.summary;
      this.categories = categories || [];
      this.products = products || [];
      this.waiters = waiters || [];
      this.hours = hours || [];
      this.loading = false;
    }).catch((err) => {
      console.error('Error cargando reportes:', err);
      this.loading = false;
    });
  }

  // ═══════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════

  formatRange(): string {
    if (this.fromDate === this.toDate) {
      return this.formatDate(this.fromDate);
    }
    return `${this.formatDate(this.fromDate)} → ${this.formatDate(this.toDate)}`;
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  /// Devuelve un % entre 0 y 100 para usar en barras
  productMaxQty(): number {
    if (this.products.length === 0) return 1;
    return Math.max(...this.products.map(p => p.quantity), 1);
  }

  hourMaxTotal(): number {
    if (this.hours.length === 0) return 1;
    return Math.max(...this.hours.map(h => h.total), 1);
  }

  waiterMaxTotal(): number {
    if (this.waiters.length === 0) return 1;
    return Math.max(...this.waiters.map(w => w.total), 1);
  }

  rankBadge(idx: number): string {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return `${idx + 1}`;
  }
}