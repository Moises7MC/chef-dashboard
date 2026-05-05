import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, Order } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

interface OrderGroup {
  tableNumber: number;
  orders: Order[];
  createdAt: string;
  status: string;
  updatedAt?: string;
  mealType?: string;
  waiterName?: string;
}

@Component({
  selector: 'app-kitchen-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kitchen-orders.component.html',
  styleUrls: ['./kitchen-orders.component.css']
})
export class KitchenOrdersComponent implements OnInit, OnDestroy {

  allOrders: Order[] = [];
  filteredOrders: OrderGroup[] = [];
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
    { key: 'Demorados', label: 'Demorados' },
    { key: 'Listo', label: 'Listo' },
    { key: 'Cobrado', label: 'Cobrado' },
    { key: 'Cancelado', label: 'Cancelado' },
  ];
  // Cronómetro
  private _timerInterval: any;
  now: number = Date.now();

  constructor(
    private orderService: OrderService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef  // ← AGREGAR
  ) { }

  // ══════════════════════════════════════════════════════════════
  // AGRUPAR ÓRDENES POR MESA (combina normal + para llevar)
  // ══════════════════════════════════════════════════════════════
  groupOrdersByTable(orders: Order[]): OrderGroup[] {
    const grouped = new Map<number, any>();

    for (const order of orders) {
      const tableNum = order.tableNumber;

      if (!grouped.has(tableNum)) {
        grouped.set(tableNum, {
          tableNumber: tableNum,
          orders: [],
          // Datos para la UI (tomados de la primera orden)
          createdAt: order.createdAt,
          status: order.status,
          updatedAt: order.updatedAt,
          mealType: order.mealType,
          waiterName: order.waiterName,
        });
      }

      grouped.get(tableNum)!.orders.push(order);
    }

    return Array.from(grouped.values());
  }

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });
    this.orderService.orders$.subscribe(() => {
      this.applyFiltersLocal();
      this.cdr.detectChanges();
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
    const date = new Date(year, month - 1, day);
    let orders = this.orderService.getOrdersByDate(date);

    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'Demorados') {
        orders = orders.filter(o => {
          const isActive = o.status === 'Enviado a cocina' || o.status === 'Pendiente';
          if (!isActive) return false;
          const mins = this.getElapsedSeconds(o.createdAt, o.status, o.updatedAt) / 60;
          return mins >= 15;
        });
      } else {
        orders = orders.filter(o => o.status === this.activeFilter);
      }
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      orders = orders.filter(o => o.tableNumber.toString().includes(q) ||
        (o.tableNumber === 0 && 'llevar'.includes(q)));
    }

    this.allOrders = this.orderService.getOrdersByDate(date);

    // ✅ NUEVO: Agrupar por mesa
    this.filteredOrders = this.groupOrdersByTable(orders);
  }

  setFilter(key: string): void {
    this.activeFilter = key;
    this.applyFiltersLocal();
  }

  getCounts(key: string): number {
    if (key === 'all') return this.allOrders.length;

    if (key === 'Demorados') {
      return this.allOrders.filter(o => {
        const isActive = o.status === 'Enviado a cocina' || o.status === 'Pendiente';
        if (!isActive) return false;
        const mins = this.getElapsedSeconds(o.createdAt, o.status, o.updatedAt) / 60;
        return mins >= 15;
      }).length;
    }

    return this.allOrders.filter(o => o.status === key).length;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'Enviado a cocina': 'Nuevo',
      'Pendiente': 'Preparando',
      'Listo': 'Listo',
      'Cancelado': 'Cancelado',
      'Cobrado': 'Cobrado',
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
      'Cobrado': 'badge-cobrado',
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
    const end = (status === 'Listo' || status === 'Cancelado' || status === "Cobrado") && updatedAt
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
    if (status === 'Cobrado') return 'timer-cobrado';
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

    if (status === 'Cobrado') return 'card-cobrado';

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

  getButtonClass(createdAt: string, status: string, updatedAt?: string): string {
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (mins < 8) return 'btn-time-green';
    if (mins < 15) return 'btn-time-orange';
    return 'btn-time-red';
  }

  getBadgeBackground(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
    // Para llevar siempre púrpura
    if (tableNumber === 0 || isParaLlevar) return '#8b5cf6';

    // Estados finales
    if (status === 'Cobrado') return '#eab308';
    if (status === 'Listo') return '#10b981';
    if (status === 'Cancelado') return '#ef4444';

    // Estados activos según tiempo
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (mins < 8) return '#10b981';  // Verde
    if (mins < 15) return '#f59e0b'; // Naranja
    return '#ef4444'; // Rojo
  }

  getBadgeColor(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
    // Para llevar
    if (tableNumber === 0 || isParaLlevar) return '#fff';

    // Cobrado tiene texto oscuro
    if (status === 'Cobrado') return '#713f12';

    // Todos los demás tienen texto blanco
    return '#fff';
  }

  removeX(entradas: string | null): string {
    if (!entradas) return '';
    return entradas.replace(/(\d+)x\s*/gi, '$1 ');
  }

  parseEntradasList(entradas: string): string[] {
    if (!entradas) return [];
    return entradas
      .replace(/(\d+)x\s*/gi, (_, n) => `${n}x `)
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  }

  isEntradaServida(order: Order, entrada: string): boolean {
    if (!order.entradasServidas) return false;

    // Si llega como string JSON del backend, parsearlo
    let servidas: string[] = [];
    if (typeof order.entradasServidas === 'string') {
      try {
        servidas = JSON.parse(order.entradasServidas as string);
      } catch {
        return false;
      }
    } else {
      servidas = order.entradasServidas;
    }

    if (!Array.isArray(servidas)) return false;

    const entradaNorm = entrada.toLowerCase().trim()
      .replace(/^\d+x\s*/i, '');
    return servidas.some(s => s.toLowerCase().trim() === entradaNorm);
  }

  // Verifica si el grupo tiene al menos una orden "para llevar"
  hasParaLlevar(group: any): boolean {
    return group.orders.some((o: Order) => o.isParaLlevar === true);
  }

  
}