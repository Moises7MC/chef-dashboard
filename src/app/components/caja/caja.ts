import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

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
  entradasAdicionales?: string | null;
  isParaLlevar?: boolean; // ✅ NUEVO
  isSeparado?: boolean;
  tableSuffix?: string | null;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  tableNumber: number | null;
  tableSuffix?: string | null;
  isParaLlevar?: boolean;
  paymentMethod: string | null;
  createdAt: string;
  orderId: number | null;
}

interface Summary {
  ingresos: number;
  gastos: number;
  balance: number;
  totalTransacciones: number;
  porMetodoPago: { metodo: string; total: number; count: number }[];
  isClosed?: boolean; // ✅ NUEVO: propiedad opcional para el estado del candado
}

interface HistorialItem {
  productId: number;
  productName?: string;
  quantity: number;
  oldQuantity?: number;
  unitPrice: number;
}

interface OrderHistory {
  id: number;
  action: string;
  roundNumber: number;
  createdAt: string;
  items: HistorialItem[];
}

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './caja.html',
  styleUrls: ['./caja.css']
})
export class CajaComponent implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;
  private apiBaseUrl = environment.apiBaseUrl;
  private hubConnection: signalR.HubConnection | null = null;

  // Datos
  ordenesListas: OrdenLista[] = [];
  transactions: Transaction[] = [];
  summary: Summary = { ingresos: 0, gastos: 0, balance: 0, totalTransacciones: 0, porMetodoPago: [], isClosed: false };

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

  // Modal historial
  showHistoryModal = false;
  historyLoading = false;
  selectedTransaction: Transaction | null = null;
  orderHistory: OrderHistory[] = [];

  loading = false;
  procesando = false;

  preciosEntradaAdicional: { [nombre: string]: number } = {};
  entradasAdicionalesParsed: string[] = [];
  totalEntradaAdicional = 0;

  cantidadTapers = 0;
  precioTaper = 1.50;

  // ✅ CORREGIDO: Toma la fecha local de tu computadora en lugar de la fecha universal UTC
  selectedDate: string = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  })();

  constructor(private http: HttpClient) { }

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

  // ✅ NUEVO MÉTODO: Se llama cuando cambias la fecha en el input de arriba
  onDateChange() {
    this.loadTransactions();
    this.loadSummary();
    // Nota: El backend por ahora devuelve el resumen y órdenes listas solo de "hoy". 
    // Si más adelante lo actualizas para buscar resumenes históricos, agregarías la llamada aquí.
  }


  loadOrdenesListas() {
    this.http.get<OrdenLista[]>(`${this.apiUrl}/transaction/ordenes-listas`).subscribe({
      next: (data) => this.ordenesListas = data,
      error: (e) => console.error(e)
    });
  }

  loadTransactions() {
    const formattedDate = this.selectedDate; // yyyy-MM-dd
    this.http.get<Transaction[]>(
      `${this.apiUrl}/transaction/by-date?date=${formattedDate}`
    ).subscribe(res => {
      this.transactions = res;
    });
  }

  loadSummary() {
    const formattedDate = this.selectedDate; // yyyy-MM-dd
    this.http.get<Summary>(`${this.apiUrl}/transaction/summary/by-date?date=${formattedDate}`).subscribe({
      next: (data) => this.summary = data,
      error: (e) => console.error(e)
    });
  }
  connectSignalR() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiBaseUrl}/hubs/orders`)
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
    this.preciosEntradaAdicional = {};
    this.totalEntradaAdicional = 0;

    // Parsear entradas adicionales del JSON
    try {
      this.entradasAdicionalesParsed = order.entradasAdicionales
        ? JSON.parse(order.entradasAdicionales)
        : [];
    } catch {
      this.entradasAdicionalesParsed = [];
    }

    // Inicializar precio en 0 para cada entrada adicional
    this.entradasAdicionalesParsed.forEach(nombre => {
      this.preciosEntradaAdicional[nombre] = 0;
    });

    // ✅ NUEVO: Si es para llevar, pre-llenar cantidad de tapers según los platos
    if (order.isParaLlevar || order.tableNumber === 0) {
      this.cantidadTapers = order.items.reduce((sum, i) => sum + i.quantity, 0);
    } else {
      this.cantidadTapers = 0;
    }

    this.showCobrarModal = true;
  }

  cobrarOrden() {
    if (!this.selectedOrder) return;
    this.procesando = true;

    const totalFinal = this.calcularTotalFinal();

    this.http.post(`${this.apiUrl}/transaction/cobrar`, {
      orderId: this.selectedOrder.id,
      paymentMethod: this.selectedPaymentMethod,
      totalOverride: totalFinal > this.selectedOrder.total ? totalFinal : null
    }).subscribe({
      next: () => {
        this.showCobrarModal = false;
        this.selectedOrder = null;
        this.procesando = false;
        this.preciosEntradaAdicional = {};
        this.entradasAdicionalesParsed = [];
        this.totalEntradaAdicional = 0;
        this.cantidadTapers = 0; // ✅ NUEVO
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

  openHistoryModal(transaction: Transaction) {
    if (!transaction.orderId) {
      return;
    }
    this.selectedTransaction = transaction;
    this.showHistoryModal = true;
    this.historyLoading = true;
    this.orderHistory = [];

    this.http.get<OrderHistory[]>(
      `${this.apiUrl}/order/${transaction.orderId}/history`
    ).subscribe({
      next: (data) => {
        this.orderHistory = data;
        this.historyLoading = false;
      },
      error: (e) => {
        console.error(e);
        this.historyLoading = false;
      }
    });
  }

  // ✅ NUEVO: Abre una pestaña en segundo plano para descargar el reporte en Excel
  descargarExcel() {
    const url = `${this.apiUrl}/transaction/export/excel?date=${this.selectedDate}`;
    window.open(url, '_blank');
  }

  // ✅ NUEVO: Abre una pestaña en segundo plano para descargar el reporte en PDF
  descargarPDF() {
    const url = `${this.apiUrl}/transaction/export/pdf?date=${this.selectedDate}`;
    window.open(url, '_blank');
  }

  // ✅ NUEVO: Calcula el total de entradas adicionales en tiempo real
  calcularTotalAdicional(): number {
    return Object.values(this.preciosEntradaAdicional)
      .reduce((sum, precio) => sum + (precio || 0), 0);
  }

  calcularTotalTaper(): number {
    return this.cantidadTapers * this.precioTaper;
  }

  esParaLlevar(): boolean {
    return !!(this.selectedOrder?.isParaLlevar || this.selectedOrder?.tableNumber === 0);
  }


  calcularTotalFinal(): number {
    return (this.selectedOrder?.total || 0)
      + this.calcularTotalAdicional()
      + this.calcularTotalTaper();
  }

  incrementarTaper() {
    this.cantidadTapers++;
  }

  decrementarTaper() {
    if (this.cantidadTapers > 0) this.cantidadTapers--;
  }
}
