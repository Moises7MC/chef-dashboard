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
    { key: 'all',              label: 'Todos'      },
    { key: 'Enviado a cocina', label: 'Nuevo'      },
    { key: 'Pendiente',        label: 'Preparando' },
    { key: 'Listo',            label: 'Listo'      },
    { key: 'Cancelado',        label: 'Cancelado'  },
  ];

  constructor(private orderService: OrderService, private auth: AuthService) {}

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });
    this.orderService.orders$.subscribe(() => {
      this.applyFiltersLocal();
    });
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
  }

  logout(): void {
    this.auth.logout();
  }

  applyFilters(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
  }

  applyFiltersLocal(): void {
    const date = new Date(this.selectedDate + 'T12:00:00');
    let orders = this.orderService.getOrdersByDate(date);

    if (this.activeFilter !== 'all') {
      orders = orders.filter(o => o.status === this.activeFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      orders = orders.filter(o => o.tableNumber.toString().includes(q));
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
      'Pendiente':        'Preparando',
      'Listo':            'Listo',
      'Cancelado':        'Cancelado',
    };
    return map[status] ?? status;
  }

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'Enviado a cocina': 'badge-new',
      'Pendiente':        'badge-pending',
      'Listo':            'badge-ready',
      'Cancelado':        'badge-cancelled',
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
}