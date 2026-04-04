import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://app-restaurant-api.onrender.com';

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
    console.log('Inicializando conexión a:', `${API_URL}/hubs/orders`);

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/orders`, {
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

  loadOrders(): Promise<void> {
    console.log('Cargando órdenes desde:', `${API_URL}/api/order`);

    return new Promise((resolve, reject) => {
      this.http.get<Order[]>(`${API_URL}/api/order`)
        .subscribe({
          next: (orders) => {
            console.log('✓ Órdenes cargadas:', orders);
            this.orders$.next(orders);
            resolve();
          },
          error: (err) => {
            console.error('✗ Error cargando órdenes:', err);
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

  updateOrderStatus(orderId: number, status: string): Promise<void> {
    console.log('Actualizando orden', orderId, 'a estado:', status);

    return new Promise((resolve, reject) => {
      this.http.put<void>(
        `${API_URL}/api/order/${orderId}/status`,
        JSON.stringify(status),
        { headers: { 'Content-Type': 'application/json' } }
      ).subscribe({
        next: () => {
          console.log('✓ Orden actualizada en BD');
          resolve();
        },
        error: (err) => {
          console.error('✗ Error actualizando orden:', err);
          reject(err);
        }
      });
    });
  }

  getOrdersByDate(date: Date): Order[] {
    // Convierte a formato YYYY-MM-DD para comparar solo la fecha
    const selectedDateStr = date.toISOString().split('T')[0];

    return this.orders$.value.filter(order => {
      // Convierte la fecha del pedido también a YYYY-MM-DD
      const orderDateStr = new Date(order.createdAt).toISOString().split('T')[0];
      console.log('Comparando:', orderDateStr, 'con', selectedDateStr);
      return orderDateStr === selectedDateStr;
    });
  }

  getTodayOrders(): Order[] {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.orders$.value.filter(order => {
      const orderDateStr = new Date(order.createdAt).toISOString().split('T')[0];
      return orderDateStr === todayStr;
    });
  }
}