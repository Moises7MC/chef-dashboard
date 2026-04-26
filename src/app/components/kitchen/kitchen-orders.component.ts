import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, Order } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-kitchen-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kitchen-orders.component.html',
  styleUrls: ['./kitchen-orders.component.css']
})
export class KitchenOrdersComponent implements OnInit, OnDestroy {

  allOrders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedDate: string = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  })();

  searchQuery: string = '';
  activeFilter: string = 'all';

  filterOptions = [
    { key: 'all', label: 'Todos' },
    { key: 'Enviado a cocina', label: 'Nuevo' },
    { key: 'Pendiente', label: 'Preparando' },
    { key: 'Listo', label: 'Listo' },
    { key: 'Cancelado', label: 'Cancelado' },
  ];

  // Cronómetro
  private _timerInterval: any;
  now: number = Date.now();

  constructor(private orderService: OrderService, private auth: AuthService) { }

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });
    this.orderService.orders$.subscribe(() => {
      this.applyFiltersLocal();
    });

    // Tick cada segundo
    this._timerInterval = setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
    clearInterval(this._timerInterval);
  }

  logout(): void { this.auth.logout(); }

  applyFilters(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
  }

  applyFiltersLocal(): void {
    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day); // fecha local sin timezone
    let orders = this.orderService.getOrdersByDate(date);
    if (this.activeFilter !== 'all') {
      orders = orders.filter(o => o.status === this.activeFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      orders = orders.filter(o => o.tableNumber.toString().includes(q) ||
        (o.tableNumber === 0 && 'llevar'.includes(q)));
    }
    this.allOrders = this.orderService.getOrdersByDate(date);
    this.filteredOrders = orders;
  }

  setFilter(key: string): void {
    this.activeFilter = key;
    this.applyFiltersLocal();
  }

  getCounts(key: string): number {
    if (key === 'all') return this.allOrders.length;
    return this.allOrders.filter(o => o.status === key).length;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'Enviado a cocina': 'Nuevo',
      'Pendiente': 'Preparando',
      'Listo': 'Listo',
      'Cancelado': 'Cancelado',
    };
    return map[status] ?? status;
  }

getBadgeClass(status: string, tableNumber?: number, isParaLlevar?: boolean): string {
  if (tableNumber === 0 || isParaLlevar) return 'badge-llevar';
  const map: Record<string, string> = {
    'Enviado a cocina': 'badge-new',
    'Pendiente': 'badge-pending',
    'Listo': 'badge-ready',
    'Cancelado': 'badge-cancelled',
  };
  return map[status] ?? '';
}

  formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima'
    });
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima'
    });
  }

  getProductName(item: any): string {
    return item?.product?.name || 'Producto';
  }

  // ── Cronómetro ──────────────────────────────────────────────

  getElapsedSeconds(createdAt: string, status?: string, updatedAt?: string): number {
    const end = (status === 'Listo' || status === 'Cancelado') && updatedAt
      ? new Date(updatedAt).getTime()
      : this.now;
    return Math.floor((end - new Date(createdAt).getTime()) / 1000);
  }

  formatElapsed(createdAt: string, status?: string, updatedAt?: string): string {
    const secs = this.getElapsedSeconds(createdAt, status, updatedAt);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  // Verde 0-10 min, naranja 10-20, rojo 20+, gris si listo/cancelado
  getTimerClass(createdAt: string, status: string, updatedAt?: string): string {
    if (status === 'Listo' || status === 'Cancelado') return 'timer-done';
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (mins < 10) return 'timer-green';
    if (mins < 20) return 'timer-orange';
    return 'timer-red';
  }

  markAsReady(orderId: number): void {
    this.orderService.updateOrderStatus(orderId, 'Listo').then(() => {
      this.orderService.markOrderAsReady(orderId).catch(console.error);
    }).catch(console.error);
  }

  downloadComprobante(orderId: number): void {
    this.orderService.downloadComprobante(orderId).catch(() => {
      alert('Error al descargar comprobante');
    });
  }

  getCardTimeClass(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
  if (status === 'Listo' || status === 'Cancelado') return '';
  if (tableNumber === 0 || isParaLlevar) return 'card-time-purple';
  const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
  if (mins < 8) return 'card-time-green';
  if (mins < 15) return 'card-time-orange';
  return 'card-time-red';
}

  isParaLlevar(order: Order): boolean {
    return order.tableNumber === 0;
  }
}