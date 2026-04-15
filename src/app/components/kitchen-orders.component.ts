import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, Order } from '../services/order.service';

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
  selectedDate: string = new Date().toISOString().split('T')[0];
  searchQuery: string = '';
  activeFilter: string = 'all';

  filterOptions = [
    { key: 'all', label: 'Todos' },
    { key: 'Enviado a cocina', label: 'Nuevo' },
    { key: 'Pendiente', label: 'Preparando' },
    { key: 'Listo', label: 'Listo' },
    { key: 'Cancelado', label: 'Cancelado' },
  ];

  selectedOrderForHistory: any = null;
  orderHistory: any[] = [];
  showHistoryModal: boolean = false;

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => {
      this.applyFilters();
    });

    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });

    this.orderService.orders$.subscribe(() => {
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
  }

  applyFilters(): void {
    this.orderService.loadOrders().then(() => {
      const date = new Date(this.selectedDate);
      let orders = this.orderService.getOrdersByDate(date);

      if (this.activeFilter !== 'all') {
        orders = orders.filter(o => o.status === this.activeFilter);
      }

      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        orders = orders.filter(o =>
          o.tableNumber.toString().includes(q)
        );
      }

      this.allOrders = this.orderService.getOrdersByDate(date);
      this.filteredOrders = orders;
    });
  }

  setFilter(key: string): void {
    this.activeFilter = key;
    this.applyFilters();
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

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'Enviado a cocina': 'badge-new',
      'Pendiente': 'badge-pending',
      'Listo': 'badge-ready',
      'Cancelado': 'badge-cancelled',
    };
    return map[status] ?? '';
  }

  markAsReady(orderId: number): void {
    this.orderService.updateOrderStatus(orderId, 'Listo').then(() => {
      this.orderService.markOrderAsReady(orderId).catch(err => {
        console.error('Error en SignalR:', err);
      });
    }).catch(err => {
      console.error('Error:', err);
    });
  }

  downloadComprobante(orderId: number): void {
    this.orderService.downloadComprobante(orderId).then(() => {
      console.log('Descarga exitosa');
    }).catch(err => {
      console.error('Error en descarga:', err);
      alert('Error al descargar comprobante');
    });
  }

  openHistoryModal(order: any): void {
    alert('Abriendo histórico para orden: ' + order.id);

    this.selectedOrderForHistory = order;
    this.showHistoryModal = true;

    this.orderService.getOrderHistory(order.id).then((history) => {
      alert('Histórico cargado: ' + JSON.stringify(history));

      this.orderHistory = history.map(entry => ({
        ...entry,
        itemsParsed: typeof entry.itemsAdded === 'string'
          ? JSON.parse(entry.itemsAdded)
          : entry.itemsAdded
      }));
      console.log('Histórico parseado:', this.orderHistory);
    }).catch(err => {
      alert('Error cargando histórico: ' + err);
      console.error('Error:', err);
    });
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this.selectedOrderForHistory = null;
    this.orderHistory = [];
  }

}