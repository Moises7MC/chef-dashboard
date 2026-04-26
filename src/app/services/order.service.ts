import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

// const API_URL = 'https://app-restaurant-api.onrender.com';
const API_URL = 'http://localhost:5245';


export interface OrderHistoryEntry {
  id: number;
  orderId: number;
  createdAt: string;
  action: string;
  itemsAdded: string;
  roundNumber?: number; // ✅ NUEVO
}

export interface OrderHistoryItem {
  productId: number;
  productName?: string;
  quantity: number;
  oldQuantity?: number;
  unitPrice: number;
  product?: { id: number; name: string };
}

// ✅ Modificación/cancelación fusionada dentro de una ronda
export interface RoundChange {
  action: 'Modificado' | 'Cancelado';
  productId: number;
  productName: string;
  oldQuantity?: number;
  newQuantity: number;
  createdAt: string;
}

export interface OrderRound {
  roundNumber: number;
  action: string;
  createdAt: string;
  items: OrderHistoryItem[];
  isLatest: boolean;
  isCancelled: boolean;
  isModified: boolean;
  changes?: RoundChange[]; // ✅ modificaciones/cancelaciones fusionadas
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
  waiterName?: string;
  rounds?: OrderRound[];
  hasMultipleRounds?: boolean;
  updatedAt?: string;
  entradas?: string;
  isParaLlevar?: boolean;
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

@Injectable({ providedIn: 'root' })
export class OrderService {
  private hubConnection: signalR.HubConnection | null = null;
  public orders$ = new BehaviorSubject<Order[]>([]);
  private productCache = new Map<number, string>();

  constructor(private http: HttpClient) {
    this.initializeConnection();
    this.preloadProducts();
  }

  private preloadProducts(): void {
    this.http.get<any[]>(`${API_URL}/api/product`).subscribe({
      next: (products) => products.forEach(p => this.productCache.set(p.id, p.name)),
      error: () => console.warn('No se pudo pre-cargar productos')
    });
  }

  private resolveProductName(productId: number, orderItems: OrderItem[], inlineProduct?: any, inlineName?: string): string {
    if (inlineName) return inlineName;
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
          const enriched = await Promise.all(orders.map(o => this.enrichOrderWithRounds(o)));
          this.orders$.next(enriched);
          resolve();
        },
        error: (err) => { console.error('Error cargando órdenes:', err); reject(err); }
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
        error: () => resolve({ ...order, rounds: [], hasMultipleRounds: false })
      });
    });
  }

  private buildRounds(history: OrderHistoryEntry[], order: Order): OrderRound[] {
    if (!history || history.length === 0) {
      return [{
        roundNumber: 1, action: 'Inicial', createdAt: order.createdAt,
        items: order.items.map(i => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice,
          product: { id: i.productId, name: this.resolveProductName(i.productId, order.items, i.product) }
        })),
        isLatest: false, isCancelled: false, isModified: false, changes: []
      }];
    }

    // ✅ Separar entradas normales de modificaciones/cancelaciones
    const normalEntries = history.filter(h => h.action === 'Inicial' || h.action === 'Agregado');
    const changeEntries = history.filter(h => h.action === 'Modificado' || h.action === 'Cancelado');

    // ✅ Construir mapa: roundNumber -> RoundChange[]
    const changesByRound = new Map<number, RoundChange[]>();

    for (const entry of changeEntries) {
      let rawItems: any[] = [];
      try {
        const parsed = JSON.parse(entry.itemsAdded);
        if (Array.isArray(parsed)) rawItems = parsed;
      } catch { rawItems = []; }

      // roundNumber del backend (nuevo) o fallback: buscar en cuál ronda normal estaba el producto
      for (const raw of rawItems) {
        const productId: number = raw.productId ?? raw.ProductId ?? 0;
        const quantity: number = raw.quantity ?? raw.Quantity ?? 1;
        const oldQty: number | undefined = raw.oldQuantity ?? raw.OldQuantity ?? undefined;
        const name: string = raw.productName ?? raw.ProductName ??
          this.resolveProductName(productId, order.items);

        // Usar roundNumber del backend si existe, sino buscar manualmente
        let targetRound = entry.roundNumber ?? this.findRoundForProduct(productId, normalEntries);

        const change: RoundChange = {
          action: entry.action as 'Modificado' | 'Cancelado',
          productId,
          productName: name,
          oldQuantity: oldQty,
          newQuantity: quantity,
          createdAt: entry.createdAt
        };

        if (!changesByRound.has(targetRound)) changesByRound.set(targetRound, []);
        changesByRound.get(targetRound)!.push(change);
      }
    }

    // ✅ Construir rondas normales con sus changes fusionados
    const rounds: OrderRound[] = normalEntries.map((entry, idx) => {
      let rawItems: any[] = [];
      try {
        const parsed = JSON.parse(entry.itemsAdded);
        if (Array.isArray(parsed)) rawItems = parsed;
      } catch { rawItems = []; }

      const roundNumber = idx + 1;
      const isLatest = normalEntries.length > 1 && idx === normalEntries.length - 1;

      const items: OrderHistoryItem[] = rawItems.map((raw: any) => {
        const productId: number = raw.productId ?? raw.ProductId ?? 0;
        const quantity: number = raw.quantity ?? raw.Quantity ?? 1;
        const unitPrice: number = raw.unitPrice ?? raw.UnitPrice ?? 0;
        const inlineName: string = raw.productName ?? raw.ProductName ?? '';
        const inlineProduct = raw.product ?? raw.Product ?? null;
        const name = this.resolveProductName(productId, order.items, inlineProduct, inlineName);
        return { productId, quantity, unitPrice, product: { id: productId, name } };
      });

      return {
        roundNumber,
        action: entry.action,
        createdAt: entry.createdAt,
        items,
        isLatest,
        isCancelled: false,
        isModified: false,
        changes: changesByRound.get(roundNumber) ?? []
      };
    });

    return rounds;
  }

  // Fallback: buscar en qué ronda normal apareció primero un producto
  private findRoundForProduct(productId: number, normalEntries: OrderHistoryEntry[]): number {
    for (let i = 0; i < normalEntries.length; i++) {
      try {
        const items = JSON.parse(normalEntries[i].itemsAdded);
        if (Array.isArray(items) && items.some((it: any) =>
          (it.productId ?? it.ProductId) === productId)) {
          return i + 1;
        }
      } catch { }
    }
    return 1; // fallback a ronda 1
  }

getOrdersByDate(date: Date): Order[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const selectedStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return this.orders$.value.filter(order => {
    const d = new Date(order.createdAt);
    const orderStr = d.toLocaleDateString('es-PE', { 
      timeZone: 'America/Lima', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    const [day, month, year] = orderStr.split('/');
    return `${year}-${month}-${day}` === selectedStr;
  });
}

  getTodayOrders(): Order[] {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return this.orders$.value.filter(o => {
      const d = new Date(o.createdAt);
      const orderStr = d.toLocaleDateString('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
      const [day, month, year] = orderStr.split('/');
      return `${year}-${month}-${day}` === today;
    });
  }

  getOrders(): Order[] { return this.orders$.value; }

  connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return Promise.resolve();
    return this.hubConnection!.start();
  }

  disconnect(): Promise<void> { return this.hubConnection!.stop(); }
  joinKitchenGroup(): Promise<void> { return this.hubConnection!.invoke('JoinKitchenGroup'); }
  markOrderAsReady(orderId: number): Promise<void> { return this.hubConnection!.invoke('OrderReady', orderId); }

  updateOrderStatus(orderId: number, status: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put<void>(`${API_URL}/api/order/${orderId}/status`, JSON.stringify(status),
        { headers: { 'Content-Type': 'application/json' } })
        .subscribe({ next: () => resolve(), error: reject });
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