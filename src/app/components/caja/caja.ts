import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';

interface OrdenLista {
  id: number;
  tableNumber: number;
  mealType: string;
  total: number;
  status: string;
  waiterName: string;
  createdAt: string;
  comanda: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  tableNumber: number | null;
  paymentMethod: string | null;
  createdAt: string;
}

interface Summary {
  ingresos: number;
  gastos: number;
  balance: number;
  totalTransacciones: number;
  porMetodoPago: { metodo: string; total: number; count: number }[];
}

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './caja.html',
  styleUrls: ['./caja.css']
})
export class CajaComponent implements OnInit, OnDestroy {
  // private apiUrl = 'http://localhost:5245/api';
  private apiUrl = 'https://app-restaurant-api.onrender.com/api';
  private hubConnection: signalR.HubConnection | null = null;

  // Datos
  ordenesListas: OrdenLista[] = [];
  transactions: Transaction[] = [];
  summary: Summary = { ingresos: 0, gastos: 0, balance: 0, totalTransacciones: 0, porMetodoPago: [] };

  // UI
  activeTab: 'cobrar' | 'transacciones' | 'resumen' = 'cobrar';
  selectedOrder: OrdenLista | null = null;
  selectedPaymentMethod = 'Efectivo';
  paymentMethods = ['Efectivo', 'Tarjeta', 'Yape', 'Plin'];

  // Modal gasto
  showGastoModal = false;
  gastoForm = { amount: 0, description: '' };
  gastoError = '';

  // Modal cobro
  showCobrarModal = false;
  cobrandoId: number | null = null;

  // Modal cierre
  showCierreModal = false;
  cierreResult: any = null;

  loading = false;
  procesando = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAll();
    this.connectSignalR();
  }

  ngOnDestroy() {
    this.hubConnection?.stop();
  }

  loadAll() {
    this.loadOrdenesListas();
    this.loadTransactions();
    this.loadSummary();
  }

  loadOrdenesListas() {
    this.http.get<OrdenLista[]>(`${this.apiUrl}/transaction/ordenes-listas`).subscribe({
      next: (data) => this.ordenesListas = data,
      error: (e) => console.error(e)
    });
  }

  loadTransactions() {
    this.http.get<Transaction[]>(`${this.apiUrl}/transaction/today`).subscribe({
      next: (data) => this.transactions = data,
      error: (e) => console.error(e)
    });
  }

  loadSummary() {
    this.http.get<Summary>(`${this.apiUrl}/transaction/summary/today`).subscribe({
      next: (data) => this.summary = data,
      error: (e) => console.error(e)
    });
  }

  connectSignalR() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl.replace('/api', '')}/hubs/orders`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('CajaActualizada', () => this.loadAll());
    this.hubConnection.on('PedidoListo', () => this.loadOrdenesListas());

    this.hubConnection.start().catch(e => console.warn('SignalR caja:', e));
  }

  // ── Cobrar orden ─────────────────────────────────────────
  openCobrarModal(order: OrdenLista) {
    this.selectedOrder = order;
    this.selectedPaymentMethod = 'Efectivo';
    this.showCobrarModal = true;
  }

  cobrarOrden() {
    if (!this.selectedOrder) return;
    this.procesando = true;
    this.http.post(`${this.apiUrl}/transaction/cobrar`, {
      orderId: this.selectedOrder.id,
      paymentMethod: this.selectedPaymentMethod
    }).subscribe({
      next: () => {
        this.showCobrarModal = false;
        this.selectedOrder = null;
        this.procesando = false;
        this.loadAll();
      },
      error: (e) => {
        alert(e.error || 'Error al cobrar');
        this.procesando = false;
      }
    });
  }

  // ── Gasto manual ─────────────────────────────────────────
  openGastoModal() {
    this.gastoForm = { amount: 0, description: '' };
    this.gastoError = '';
    this.showGastoModal = true;
  }

  registrarGasto() {
    if (this.gastoForm.amount <= 0) { this.gastoError = 'El monto debe ser mayor a 0'; return; }
    if (!this.gastoForm.description.trim()) { this.gastoError = 'La descripción es requerida'; return; }
    this.procesando = true;
    this.http.post(`${this.apiUrl}/transaction/gasto`, this.gastoForm).subscribe({
      next: () => {
        this.showGastoModal = false;
        this.procesando = false;
        this.loadAll();
      },
      error: () => { this.gastoError = 'Error al registrar gasto'; this.procesando = false; }
    });
  }

  // ── Cierre de caja ────────────────────────────────────────
  openCierreModal() { this.showCierreModal = true; this.cierreResult = null; }

  ejecutarCierre() {
    this.procesando = true;
    this.http.post(`${this.apiUrl}/transaction/cierre`, {}).subscribe({
      next: (res) => {
        this.cierreResult = res;
        this.procesando = false;
        this.loadAll();
      },
      error: (e) => { alert(e.error || 'Error al cerrar caja'); this.procesando = false; this.showCierreModal = false; }
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima'
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima'
    });
  }

  getPaymentIcon(method: string | null): string {
    const icons: Record<string, string> = {
      'Efectivo': '💵', 'Tarjeta': '💳', 'Yape': '📱', 'Plin': '📲'
    };
    return icons[method || ''] || '💰';
  }

  getPaymentColor(method: string): string {
    const colors: Record<string, string> = {
      'Efectivo': '#059669', 'Tarjeta': '#2563eb', 'Yape': '#7c3aed', 'Plin': '#0891b2'
    };
    return colors[method] || '#6b7280';
  }
}