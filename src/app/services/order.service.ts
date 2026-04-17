import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

const API_URL = 'http://localhost:5245';

export interface OrderHistoryEntry {
  id: number;
  orderId: number;
  createdAt: string;
  action: string;
  itemsAdded: string;
}

export interface OrderHistoryItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  product?: { id: number; name: string };
}

export interface OrderRound {
  roundNumber: number;
  action: string;
  createdAt: string;
  items: OrderHistoryItem[];
  isLatest: boolean;
}

export interface Order {
  id: number;
  tableNumber: number;
  mealType: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
  comanda: string;
  rounds?: OrderRound[];
  hasMultipleRounds?: boolean;
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

  // Cache de productos: id -> nombre
  private productCache = new Map<number, string>();

  constructor(private http: HttpClient) {
    this.initializeConnection();
    this.preloadProducts();  // ← carga nombres al iniciar
  }

  // Carga todos los productos una sola vez para tener sus nombres
  private preloadProducts(): void {
    this.http.get<any[]>(`${API_URL}/api/product`).subscribe({
      next: (products) => {
        products.forEach(p => this.productCache.set(p.id, p.name));
      },
      error: () => console.warn('No se pudo pre-cargar productos')
    });
  }

  // 3 fuentes de fallback para resolver el nombre
  private resolveProductName(
    productId: number,
    orderItems: OrderItem[],
    inlineProduct?: { id?: number; name?: string } | null
  ): string {
    if (inlineProduct?.name) return inlineProduct.name;
    if (this.productCache.has(productId)) return this.productCache.get(productId)!;
    const found = orderItems.find(oi => oi.productId === productId);
    if (found?.product?.name) return found.product.name;
    return `Producto #${productId}`;
  }

  private initializeConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/orders`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('NuevoPedido', () => this.loadOrders());
    this.hubConnection.on('PedidoListo', () => this.loadOrders());
    this.hubConnection.on('ActualizacionPedido', () => this.loadOrders());
  }

  loadOrders(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Order[]>(`${API_URL}/api/order`).subscribe({
        next: async (orders) => {
          const enriched = await Promise.all(
            orders.map(o => this.enrichOrderWithRounds(o))
          );
          this.orders$.next(enriched);
          resolve();
        },
        error: (err) => {
          console.error('Error cargando órdenes:', err);
          reject(err);
        }
      });
    });
  }

  private enrichOrderWithRounds(order: Order): Promise<Order> {
    return new Promise((resolve) => {
      this.http.get<OrderHistoryEntry[]>(`${API_URL}/api/order/${order.id}/history`).subscribe({
        next: (history) => {
          const rounds = this.buildRounds(history, order);
          resolve({ ...order, rounds, hasMultipleRounds: rounds.length > 1 });
        },
        error: () => {
          resolve({ ...order, rounds: [], hasMultipleRounds: false });
        }
      });
    });
  }

  private buildRounds(history: OrderHistoryEntry[], order: Order): OrderRound[] {
    if (!history || history.length === 0) {
      return [{
        roundNumber: 1,
        action: 'Inicial',
        createdAt: order.createdAt,
        items: order.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          product: {
            id: i.productId,
            name: this.resolveProductName(i.productId, order.items, i.product)
          }
        })),
        isLatest: false
      }];
    }

    return history.map((entry, index) => {
      let rawItems: any[] = [];
      try {
        const parsed = JSON.parse(entry.itemsAdded);
        if (Array.isArray(parsed)) rawItems = parsed;
      } catch {
        rawItems = [];
      }

      const items: OrderHistoryItem[] = rawItems.map((raw: any) => {
        const productId: number = raw.productId ?? raw.ProductId ?? 0;
        const quantity: number = raw.quantity ?? raw.Quantity ?? 1;
        const unitPrice: number = raw.unitPrice ?? raw.UnitPrice ?? 0;
        const inlineProduct = raw.product ?? raw.Product ?? null;
        const name = this.resolveProductName(productId, order.items, inlineProduct);
        return { productId, quantity, unitPrice, product: { id: productId, name } };
      });

      return {
        roundNumber: index + 1,
        action: entry.action,
        createdAt: entry.createdAt,
        items,
        isLatest: index === history.length - 1 && history.length > 1
      };
    });
  }

  getOrdersByDate(date: Date): Order[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    const selectedStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return this.orders$.value.filter(order => {
      const d = new Date(order.createdAt);
      // Convertir de UTC a hora Perú (UTC-5)
      const peruOffset = -5 * 60;
      const localMs = d.getTime() + (peruOffset - d.getTimezoneOffset()) * 60000;
      const local = new Date(localMs);
      const orderStr = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
      return orderStr === selectedStr;
    });
  }

  getTodayOrders(): Order[] {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    return this.orders$.value.filter(o => {
      const d = new Date(o.createdAt);
      // Convertir UTC → hora Perú (UTC-5)
      const local = new Date(d.getTime() + (-5 * 60 - d.getTimezoneOffset()) * 60000);
      const orderDate = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
      return orderDate === today;
    });
  }

  getOrders(): Order[] {
    return this.orders$.value;
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

  updateOrderStatus(orderId: number, status: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put<void>(
        `${API_URL}/api/order/${orderId}/status`,
        JSON.stringify(status),
        { headers: { 'Content-Type': 'application/json' } }
      ).subscribe({ next: () => resolve(), error: reject });
    });
  }

  downloadComprobante(orderId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get(`${API_URL}/api/order/${orderId}/comprobante`, { responseType: 'blob' })
        .subscribe({
          next: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Comprobante_${orderId}_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            resolve();
          },
          error: reject
        });
    });
  }
}