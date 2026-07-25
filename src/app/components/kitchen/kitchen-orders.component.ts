import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, Order } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';

interface OrderGroup {
  tableNumber: number;
  orders: Order[];
  createdAt: string;
  status: string;
  updatedAt?: string;
  mealType?: string;
  waiterName?: string;
  tableSuffix?: string | null;
}

@Component({
  selector: 'app-kitchen-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kitchen-orders.component.html',
  styleUrls: ['./kitchen-orders.component.css']
})
export class KitchenOrdersComponent implements OnInit, OnDestroy {

  allOrders: Order[] = [];
  filteredOrders: OrderGroup[] = [];
  selectedDate: string = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  })();

  searchQuery: string = '';
  activeFilter: string = 'all';

  // ✅ Pedidos resueltos (Cobrado/Cancelado) se agrupan aparte, en una lista
  //    compacta y colapsable, para que no compitan visualmente con los
  //    pedidos activos cuando hay muchas órdenes en el día.
  finishedCollapsed = false;

  // ✅ Umbrales de tiempo (antes hardcodeados) — ahora configurables desde
  //    Menús → Tiempos y compartidos con el Cantador de la app.
  warningMinutes = 8;
  dangerMinutes = 15;

  // ✅ Todas las filas (activas o resueltas) son compactas — el detalle
  //    completo del pedido se ve en un modal, no desplegado en línea.
  //    Guardamos solo la clave y recalculamos el grupo desde filteredOrders
  //    para que el modal se mantenga actualizado si llega una actualización
  //    (SignalR) mientras está abierto.
  private selectedGroupKey: string | null = null;

  get selectedGroup(): OrderGroup | null {
    if (!this.selectedGroupKey) return null;
    return this.filteredOrders.find(g => this.groupKey(g) === this.selectedGroupKey) ?? null;
  }

  filterOptions = [
    { key: 'all', label: 'Todos' },
    { key: 'Enviado a cocina', label: 'Nuevo' },
    { key: 'Pendiente', label: 'Preparando' },
    { key: 'Demorados', label: 'Demorados' },
    { key: 'Listo', label: 'Listo' },
    { key: 'Cobrado', label: 'Cobrado' },
    { key: 'Cancelado', label: 'Cancelado' },
    { key: 'Eliminado', label: 'Eliminado' },
  ];

  private _timerInterval: any;
  now: number = Date.now();

  constructor(
    private orderService: OrderService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private settingsService: SettingsService
  ) { }

  // ✅ Agrupar órdenes considerando tableNumber > 100 como "para llevar" (Caja)
  groupOrdersByTable(orders: Order[]): OrderGroup[] {
    const grouped = new Map<string, any>();

    for (const order of orders) {
      // ✅ Pedidos de Caja (tableNumber > 100), para llevar (tableNumber === 0)
      // o SEPARADOS (subpedidos independientes de la misma mesa) — cada uno es su propio grupo
      const key = (order.tableNumber === 0 || order.tableNumber > 100 || order.isSeparado)
        ? `order-${order.id}`
        : `table-${order.tableNumber}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          tableNumber: order.tableNumber,
          orders: [],
          createdAt: order.createdAt,
          status: order.status,
          updatedAt: order.updatedAt,
          mealType: order.mealType,
          waiterName: order.waiterName,
          tableSuffix: order.tableSuffix,
        });
      }

      grouped.get(key)!.orders.push(order);
    }

    return Array.from(grouped.values());
  }

  ngOnInit(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
    this.orderService.connect().then(() => {
      this.orderService.joinKitchenGroup();
    });
    this.orderService.orders$.subscribe(() => {
      this.applyFiltersLocal();
      this.cdr.detectChanges();
    });

    this.settingsService.timers$.subscribe(timers => {
      this.warningMinutes = timers.warningMinutes;
      this.dangerMinutes = timers.dangerMinutes;
      this.applyFiltersLocal();
    });

    this._timerInterval = setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.orderService.disconnect();
    clearInterval(this._timerInterval);
  }

  logout(): void { this.auth.logout(); }

  applyFilters(): void {
    this.orderService.loadOrders().then(() => this.applyFiltersLocal());
  }

  applyFiltersLocal(): void {
    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    let orders = this.orderService.getOrdersByDate(date);

    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'Demorados') {
        orders = orders.filter(o => {
          const isActive = o.status === 'Enviado a cocina' || o.status === 'Pendiente';
          if (!isActive) return false;
          const mins = this.getElapsedSeconds(o.createdAt, o.status, o.updatedAt) / 60;
          return mins >= this.dangerMinutes;
        });
      } else if (this.activeFilter === 'Eliminado') {
        orders = orders.filter(o => o.isDeleted);
      } else {
        orders = orders.filter(o => o.status === this.activeFilter);
      }
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      orders = orders.filter(o => o.tableNumber.toString().includes(q) ||
        (o.tableNumber === 0 && 'llevar'.includes(q)));
    }

    this.allOrders = this.orderService.getOrdersByDate(date);
    this.filteredOrders = this.groupOrdersByTable(orders);
  }

  setFilter(key: string): void {
    this.activeFilter = key;
    this.applyFiltersLocal();
  }

  // ═══════════════════════════════════════════════════
  // ✅ SEPARACIÓN VISUAL: activos (arriba, en grilla) vs.
  //    resueltos (abajo, en lista compacta y colapsable)
  // ═══════════════════════════════════════════════════

  isFinished(group: OrderGroup): boolean {
    return group.status === 'Cobrado' || group.status === 'Cancelado' || this.groupHasDeleted(group);
  }

  // ✅ Un grupo con algún pedido eliminado se manda a "Resueltos" — ya no es
  //    trabajo pendiente para cocina, pero debe quedar visible (tachado) para
  //    que el dueño pueda auditar qué se eliminó.
  groupHasDeleted(group: OrderGroup): boolean {
    return group.orders.some(o => o.isDeleted);
  }

  groupAllDeleted(group: OrderGroup): boolean {
    return group.orders.length > 0 && group.orders.every(o => o.isDeleted);
  }

  private activePriority(group: OrderGroup): number {
    if (group.status === 'Listo') return 3;
    const mins = this.getElapsedSeconds(group.createdAt, group.status, group.updatedAt) / 60;
    if (mins >= this.dangerMinutes) return 0; // Demorado — máxima prioridad visual
    return group.status === 'Enviado a cocina' ? 1 : 2; // Nuevo antes que Preparando
  }

  get activeGroups(): OrderGroup[] {
    return this.filteredOrders
      .filter(g => !this.isFinished(g))
      .sort((a, b) =>
        this.activePriority(a) - this.activePriority(b) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  get finishedGroups(): OrderGroup[] {
    return this.filteredOrders
      .filter(g => this.isFinished(g))
      .sort((a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
  }

  groupTotal(group: OrderGroup): number {
    return group.orders.reduce((sum, o) => sum + (o.total || 0), 0);
  }

  groupKey(group: OrderGroup): string {
    return group.orders.map(o => o.id).join('-');
  }

  // ✅ Arrow function (no método de clase normal): Angular invoca el trackBy
  //    como una referencia suelta (this.differ._trackByFn(index, item)), así
  //    que un método normal pierde el "this" del componente. La arrow function
  //    lo captura de forma léxica y evita el "this.groupKey is not a function".
  trackByGroup = (index: number, group: OrderGroup): string => {
    return this.groupKey(group);
  };

  openDetail(group: OrderGroup): void {
    this.selectedGroupKey = this.groupKey(group);
  }

  closeDetail(): void {
    this.selectedGroupKey = null;
  }

  getCounts(key: string): number {
    if (key === 'all') return this.allOrders.length;

    if (key === 'Demorados') {
      return this.allOrders.filter(o => {
        const isActive = o.status === 'Enviado a cocina' || o.status === 'Pendiente';
        if (!isActive) return false;
        const mins = this.getElapsedSeconds(o.createdAt, o.status, o.updatedAt) / 60;
        return mins >= this.dangerMinutes;
      }).length;
    }

    if (key === 'Eliminado') {
      return this.allOrders.filter(o => o.isDeleted).length;
    }

    return this.allOrders.filter(o => o.status === key).length;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'Enviado a cocina': 'Nuevo',
      'Pendiente': 'Preparando',
      'Listo': 'Listo',
      'Cancelado': 'Cancelado',
      'Cobrado': 'Cobrado',
    };
    return map[status] ?? status;
  }

  getBadgeClass(status: string, tableNumber?: number, isParaLlevar?: boolean): string {
    if (tableNumber === 0 || tableNumber! > 100 || isParaLlevar) return 'badge-llevar';
    const map: Record<string, string> = {
      'Enviado a cocina': 'badge-new',
      'Pendiente': 'badge-pending',
      'Listo': 'badge-ready',
      'Cancelado': 'badge-cancelled',
      'Cobrado': 'badge-cobrado',
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

  // ✅ Nombre de pila (sin apellido) para las etiquetas de "otro mozo"
  firstName(fullName?: string | null): string {
    return (fullName || '').trim().split(/\s+/)[0] || '';
  }

  private namesDiffer(a?: string | null, b?: string | null): boolean {
    const normA = (a || '').trim().toLowerCase();
    const normB = (b || '').trim().toLowerCase();
    return normA.length > 0 && normA !== normB;
  }

  // Nombre a mostrar junto a un plato (segundo) de una ronda, solo si
  // la ronda la mandó un mozo distinto al que creó el pedido.
  roundWaiterLabel(round: any, order: Order): string | null {
    if (!this.namesDiffer(round?.waiterName, order.waiterName)) return null;
    return this.firstName(round.waiterName);
  }

  // Nombre a mostrar junto a una entrada marcada "(NUEVO)", basado en quién
  // fue el último en tocar el pedido (las entradas no se rastrean por ronda).
  entradaWaiterLabel(order: Order): string | null {
    if (!this.namesDiffer(order.lastEditedByWaiter, order.waiterName)) return null;
    return this.firstName(order.lastEditedByWaiter);
  }

  entradaIsNew(name: string): boolean {
    return !!name && name.includes('(NUEVO)');
  }

  getElapsedSeconds(createdAt: string, status?: string, updatedAt?: string): number {
    // Convertimos a milisegundos ignorando la zona horaria del navegador
    // Usamos el valor UTC para que sea consistente con C#
    const createdDate = new Date(createdAt).getTime();

    // Si la orden ya terminó, usamos la fecha de actualización
    const end = (status === 'Listo' || status === 'Cancelado' || status === "Cobrado") && updatedAt
      ? new Date(updatedAt).getTime()
      : Date.now(); // Usamos Date.now() directo para mayor precisión

    // Calculamos la diferencia
    const diff = Math.floor((end - createdDate) / 1000);

    // 🛑 IMPORTANTE: Si la diferencia es mayor a 4 horas (14400 seg), 
    // es casi seguro un error de zona horaria (UTC vs Local).
    // Si la diferencia es negativa o absurda, forzamos a 0.
    if (diff < 0) return 0;

    return diff;
  }

  formatElapsed(createdAt: string, status?: string, updatedAt?: string): string {
    const secs = this.getElapsedSeconds(createdAt, status, updatedAt);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  getTimerClass(createdAt: string, status: string, updatedAt?: string, isParaLlevar?: boolean): string {
    if (status === 'Cobrado') return 'timer-cobrado';
    if (status === 'Listo' || status === 'Cancelado') return 'timer-done';
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (isParaLlevar) {
      if (mins < this.dangerMinutes) return 'timer-green';
      return 'timer-red';
    }
    if (mins < this.warningMinutes) return 'timer-green';
    if (mins < this.dangerMinutes) return 'timer-orange';
    return 'timer-red';
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

  deleteOrder(order: Order): void {
    const label = (order.tableNumber === 0 || order.tableNumber > 100)
      ? 'este pedido para llevar'
      : `el pedido de la Mesa ${order.tableNumber}${order.tableSuffix || ''}`;

    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;

    this.orderService.deleteOrder(order.id)
      .then(() => this.applyFilters())
      .catch(() => alert('Error al eliminar el pedido'));
  }

  getCardTimeClass(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
    if (status === 'Cobrado') return 'card-cobrado';
    if (status === 'Listo' || status === 'Cancelado') return '';

    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;

    if (tableNumber === 0 || tableNumber! > 100 || isParaLlevar) {
      if (mins < this.dangerMinutes) return 'card-time-purple';
      return 'card-time-red';
    }

    if (mins < this.warningMinutes) return 'card-time-green';
    if (mins < this.dangerMinutes) return 'card-time-orange';
    return 'card-time-red';
  }

  isParaLlevar(order: Order): boolean {
    return order.tableNumber === 0 || order.tableNumber > 100;
  }

  getButtonClass(createdAt: string, status: string, updatedAt?: string, isParaLlevar?: boolean): string {
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (isParaLlevar) {
      if (mins < this.dangerMinutes) return 'btn-time-purple';
      return 'btn-time-red';
    }
    if (mins < this.warningMinutes) return 'btn-time-green';
    if (mins < this.dangerMinutes) return 'btn-time-orange';
    return 'btn-time-red';
  }

  getBadgeBackground(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
    if (tableNumber === 0 || tableNumber! > 100 || isParaLlevar) {
      const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
      if (mins < this.dangerMinutes) return '#8b5cf6';
      return '#ef4444';
    }
    if (status === 'Cobrado') return '#eab308';
    if (status === 'Listo') return '#10b981';
    if (status === 'Cancelado') return '#ef4444';
    const mins = this.getElapsedSeconds(createdAt, status, updatedAt) / 60;
    if (mins < this.warningMinutes) return '#10b981';
    if (mins < this.dangerMinutes) return '#f59e0b';
    return '#ef4444';
  }

  getBadgeColor(createdAt: string, status: string, updatedAt?: string, tableNumber?: number, isParaLlevar?: boolean): string {
    if (tableNumber === 0 || tableNumber! > 100 || isParaLlevar) return '#fff';
    if (status === 'Cobrado') return '#713f12';
    return '#fff';
  }

  removeX(entradas: string | null): string {
    if (!entradas) return '';
    return entradas.replace(/(\d+)x\s*/gi, '$1 ');
  }

  parseEntradasList(entradas: string): string[] {
    if (!entradas) return [];
    return entradas
      .replace(/(\d+)x\s*/gi, (_, n) => `${n}x `)
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  }

  isEntradaServida(order: Order, entrada: string): boolean {
    if (!order.entradasServidas) return false;

    let servidas: string[] = [];
    if (typeof order.entradasServidas === 'string') {
      try {
        servidas = JSON.parse(order.entradasServidas as string);
      } catch {
        return false;
      }
    } else {
      servidas = order.entradasServidas;
    }

    if (!Array.isArray(servidas)) return false;

    const entradaNorm = entrada.toLowerCase().trim()
      .replace(/^\d+x\s*/i, '');
    return servidas.some(s => s.toLowerCase().trim() === entradaNorm);
  }

  hasParaLlevar(group: any): boolean {
    return group.orders.some((o: Order) => o.isParaLlevar === true || o.tableNumber === 0 || o.tableNumber > 100);
  }

  getSegundos(order: any): string[] {
    if (!order.detalle) return [];

    const partes = order.detalle.split(/Segundos/i);
    if (partes.length < 2) return [];

    return partes[1]
      .split('\n')
      .map((x: string) => x.trim())
      .filter((x: string) => x && !x.toLowerCase().includes('ronda'));
  }
  // ✅ NUEVA LÓGICA: Combina el string de entradas con el JSON de servidas para obtener la fracción
  // ✅ LÓGICA CORREGIDA: Ahora soporta saltos de línea (\n) y múltiples formatos
  getEntradasStatus(order: any): { name: string, total: number, servidas: number }[] {
    if (!order.entradas) return [];

    const trimmed = order.entradas.trim();
    let itemsRaw: string[] = [];

    // 1. Intentar parsear como JSON o dividir por comas, punto y coma, o saltos de línea (\n)
    if (trimmed.startsWith('[')) {
      try {
        itemsRaw = JSON.parse(trimmed);
      } catch {
        itemsRaw = trimmed.split(/[,;\n]+/);
      }
    } else {
      itemsRaw = trimmed.split(/[,;\n]+/);
    }

    // Limpiar espacios vacíos
    itemsRaw = itemsRaw.map((e: string) => e.trim()).filter((e: string) => {
      return e.length > 0 && e !== '🔸 NUEVO:';
    });

    // 2. Obtener las ya servidas desde el backend
    let servidasArray: string[] = [];
    if (order.entradasServidas) {
      try {
        servidasArray = typeof order.entradasServidas === 'string'
          ? JSON.parse(order.entradasServidas)
          : order.entradasServidas;
      } catch { }
    }

    // Normalizar para poder cruzar datos sin importar mayúsculas
    const servidasNorm = servidasArray.map(s => s.toLowerCase().trim());
    const result = [];

    // 3. Formatear cada entrada por separado
    for (const raw of itemsRaw) {
      let total = 1;
      let name = raw;

      // Buscar formato "2x ensalada rusa" o "2 x ensalada rusa"
      const matchPre = raw.match(/^\s*(\d+)\s*x\s+(.+)$/i);
      if (matchPre) {
        total = parseInt(matchPre[1], 10);
        name = matchPre[2].trim();
      } else {
        // Buscar formato "ensalada rusa x2" (por si algún mozo lo escribe así)
        const matchSuf = raw.match(/(.+)\s*x\s*(\d+)$/i);
        if (matchSuf) {
          total = parseInt(matchSuf[2], 10);
          name = matchSuf[1].trim();
        }
      }

      const nameNorm = name.toLowerCase().trim();
      let servidasCount = 0;

      // Contar cuántas unidades de ESTE plato específico ya salieron
      for (let i = 0; i < total; i++) {
        const idx = servidasNorm.indexOf(nameNorm);
        if (idx >= 0) {
          servidasCount++;
          servidasNorm.splice(idx, 1); // Lo quitamos para no contarlo doble
        }
      }

      result.push({
        name: name,
        total: total,
        servidas: servidasCount
      });
    }

    return result;
  }

  // ✅ NUEVA LÓGICA: Construye las rondas exactas leyendo el historial de la BD
  getValidRounds(order: any): any[] | null {
    if (!order.history) return null;

    // Filtramos las acciones que agregaron platos
    const addActions = order.history.filter((h: any) => h.action === 'Inicial' || h.action === 'Agregado');

    // Si solo hay 1 envío, no mostramos "Rondas", mostramos la lista plana normal
    if (addActions.length <= 1) return null;

    const rounds: any[] = [];
    let roundNum = 1;

    for (let i = 0; i < addActions.length; i++) {
      const h = addActions[i];
      let itemsInRound: any[] = [];

      if (h.itemsAdded) {
        try {
          const parsed = JSON.parse(h.itemsAdded);
          itemsInRound = parsed.map((p: any) => {
            const realItem = order.items?.find((oi: any) => oi.productId === p.productId);
            return {
              quantity: p.quantity,
              product: realItem?.product || { name: 'Producto #' + p.productId },
              servedQuantity: realItem?.servedQuantity || 0
            };
          });
        } catch (e) { }
      }

      // Rescatar modificaciones (editados/eliminados) que pertenezcan a esta ronda
      const changes = order.history.filter((ch: any) =>
        (ch.action === 'Modificado' || ch.action === 'Cancelado') &&
        ch.roundNumber === roundNum
      ).map((ch: any) => {
        try {
          const parsed = JSON.parse(ch.itemsAdded)[0];
          return {
            action: ch.action,
            productName: parsed.productName || parsed.product?.name,
            oldQuantity: parsed.oldQuantity,
            newQuantity: parsed.quantity
          };
        } catch (e) { return null; }
      }).filter((ch: any) => ch !== null);

      rounds.push({
        roundNumber: roundNum,
        createdAt: h.createdAt,
        isLatest: i === addActions.length - 1,
        items: itemsInRound,
        changes: changes
      });

      roundNum++;
    }
    return rounds;
  }

  // ✅ NUEVO: Parsea el JSON de entradas adicionales
  parseEntradasAdicionales(entradasAdicionales: string | null): string[] {
    if (!entradasAdicionales) return [];
    try {
      const parsed = JSON.parse(entradasAdicionales);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}