import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService, Order } from '../services/order.service';

@Component({
  selector: 'app-kitchen-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kitchen-orders.component.html',
  styleUrls: ['./kitchen-orders.component.css']
})
export class KitchenOrdersComponent implements OnInit, OnDestroy {
  pendingOrders: Order[] = [];
  readyOrders: Order[] = [];

  constructor(private orderService: OrderService) { }

  ngOnInit(): void {
    // Cargar órdenes existentes
    this.orderService.loadOrders().then(() => {
      this.updateOrderLists();
    });

    // Conectar a SignalR
    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });

    // Escuchar cambios en órdenes
    this.orderService.orders$.subscribe(() => {
      this.updateOrderLists();
    });
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
  }

  private updateOrderLists(): void {
    const allOrders = this.orderService.getOrders();
    this.pendingOrders = allOrders.filter(o => o.status === 'Enviado a cocina' || o.status === 'Pendiente');
    this.readyOrders = allOrders.filter(o => o.status === 'Listo');
  }

  markAsReady(orderId: number): void {
    console.log('Marcando como listo:', orderId);

    // Primero actualiza en BD
    this.orderService.updateOrderStatus(orderId, 'Listo').then(() => {
      console.log('✓ Cambio guardado en BD');

      // Luego invoca SignalR para notificar a otros
      this.orderService.markOrderAsReady(orderId).catch(err => {
        console.error('Error en SignalR:', err);
      });
    }).catch(err => {
      console.error('✗ Error:', err);
    });
  }
}