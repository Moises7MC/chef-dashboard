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
  pendingOrders: Order[] = [];
  readyOrders: Order[] = [];
  selectedDate: string = new Date().toISOString().split('T')[0]; // Hoy por defecto

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => {
      this.filterByDate();
    });

    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });

    this.orderService.orders$.subscribe(() => {
      this.filterByDate();
    });
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
  }

  filterByDate(): void {
    const selectedDate = new Date(this.selectedDate);
    const allOrders = this.orderService.getOrdersByDate(selectedDate);
    
    this.pendingOrders = allOrders.filter(o => o.status === 'Enviado a cocina' || o.status === 'Pendiente');
    this.readyOrders = allOrders.filter(o => o.status === 'Listo');
  }

  markAsReady(orderId: number): void {
    this.orderService.updateOrderStatus(orderId, 'Listo').then(() => {
      this.orderService.markOrderAsReady(orderId).catch(err => {
        console.error('Error en SignalR:', err);
      });
    }).catch(err => {
      console.error('✗ Error:', err);
    });
  }
}