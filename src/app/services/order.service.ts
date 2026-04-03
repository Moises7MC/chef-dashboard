import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface Order {
  id: number;
  tableNumber: number;
  mealType: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  product?: { id: number; name: string };
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private hubConnection: signalR.HubConnection | null = null;
  public orders$ = new BehaviorSubject<Order[]>([]);

  constructor(private http: HttpClient) {
    this.initializeConnection();
  }

  private initializeConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5245/hubs/orders', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('NuevoPedido', (order: Order) => {
      const currentOrders = this.orders$.value;
      this.orders$.next([...currentOrders, order]);
      console.log('Nuevo pedido recibido:', order);
    });

    this.hubConnection.on('PedidoListo', (orderId: number) => {
      const currentOrders = this.orders$.value;
      const updated = currentOrders.map(order =>
        order.id === orderId ? { ...order, status: 'Listo' } : order
      );
      this.orders$.next(updated);
    });

    this.hubConnection.on('ActualizacionPedido', (data: { orderId: number; status: string }) => {
      const currentOrders = this.orders$.value;
      const updated = currentOrders.map(order =>
        order.id === data.orderId ? { ...order, status: data.status } : order
      );
      this.orders$.next(updated);
    });
  }

  // ← AGREGA ESTO
 loadOrders(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.http.get<Order[]>('http://localhost:5245/api/order')
      .subscribe({
        next: (orders) => {
          console.log('Órdenes cargadas:', orders);
          this.orders$.next(orders);
          resolve();
        },
        error: (err) => {
          console.error('Error cargando órdenes:', err);
          reject(err);
        }
      });
  });
}

  connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve();
    }
    return this.hubConnection!.start();
  }

  disconnect(): Promise<void> {
    return this.hubConnection!.stop();
  }

  joinKitchenGroup(): Promise<void> {
    return this.hubConnection!.invoke('JoinKitchenGroup');
  }

  markOrderAsReady(orderId: number): Promise<void> {
    return this.hubConnection!.invoke('OrderReady', orderId);
  }

  getOrders(): Order[] {
    return this.orders$.value;
  }
}