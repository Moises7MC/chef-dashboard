import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Product {
    id: number;
    name: string;
    price: number;
    categoryId: number;
    imageUrl?: string;
    isAvailable: boolean;
}

interface Category {
    id: number;
    name: string;
}

interface CartItem {
    product: Product;
    quantity: number;
}

interface DailyEntrada {
    id: number;
    name: string;
    isActive: boolean;
}

@Component({
    selector: 'app-venta-directa',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    templateUrl: './ventaDirecta.html',
    styleUrls: ['./ventaDirecta.css']
})
export class VentaDirectaComponent implements OnInit {
    private apiUrl = 'http://localhost:5245/api';
    // private apiUrl = 'https://app-restaurant-api.onrender.com/api';

    categories: Category[] = [];
    products: Product[] = [];
    filteredProducts: Product[] = [];
    cart: CartItem[] = [];

    // Agrega estas propiedades a la clase:
    entradas: DailyEntrada[] = [];
    selectedEntradas: { entrada: DailyEntrada; quantity: number }[] = [];
    showEntradasTab = false;


    selectedCategoryId: number | null = null;
    searchQuery = '';
    mealType = 'Almuerzo';
    mealTypes = ['Desayuno', 'Almuerzo', 'Cena'];

    // Modales
    showConfirmModal = false;
    showCobrarModal = false;
    selectedPaymentMethod = 'Efectivo';
    paymentMethods = ['Efectivo', 'Tarjeta', 'Yape', 'Plin'];

    procesando = false;
    ordenCreadaId: number | null = null;
    successMessage = '';

    constructor(private http: HttpClient) { }

    ngOnInit() {
  this.loadCategories();
  this.loadProducts();
  this.loadEntradas(); // ← agregar esta línea
}

    loadCategories() {
        this.http.get<Category[]>(`${this.apiUrl}/category`).subscribe({
            next: (data) => this.categories = data,
            error: (e) => console.error(e)
        });
    }

    loadProducts() {
        this.http.get<Product[]>(`${this.apiUrl}/product`).subscribe({
            next: (data) => {
                this.products = data.filter(p => p.isAvailable !== false);
                this.applyFilters();
            },
            error: (e) => console.error(e)
        });
    }

    applyFilters() {
        let result = this.products;
        if (this.selectedCategoryId !== null) {
            result = result.filter(p => p.categoryId === this.selectedCategoryId);
        }
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(q));
        }
        this.filteredProducts = result;
    }

    selectCategory(id: number | null) {
        this.selectedCategoryId = id;
        this.applyFilters();
    }

    // Agrega este método:
    loadEntradas() {
        this.http.get<DailyEntrada[]>(`${this.apiUrl}/entrada/today`).subscribe({
            next: (data) => {
                this.entradas = data.filter(e => e.isActive);
                this.showEntradasTab = this.entradas.length > 0;
            },
            error: () => { }
        });
    }

    getEntradasQuantity(id: number): number {
        return this.selectedEntradas.find(e => e.entrada.id === id)?.quantity ?? 0;
    }

    addEntrada(entrada: DailyEntrada) {
        const ex = this.selectedEntradas.find(e => e.entrada.id === entrada.id);
        if (ex) ex.quantity++;
        else this.selectedEntradas.push({ entrada, quantity: 1 });
    }

    removeEntrada(id: number) {
        const idx = this.selectedEntradas.findIndex(e => e.entrada.id === id);
        if (idx === -1) return;
        if (this.selectedEntradas[idx].quantity > 1) this.selectedEntradas[idx].quantity--;
        else this.selectedEntradas.splice(idx, 1);
    }

    get entradasText(): string | null {
        if (this.selectedEntradas.length === 0) return null;
        return this.selectedEntradas.map(e => `${e.quantity}x ${e.entrada.name}`).join(', ');
    }

    // ── Carrito ──────────────────────────────────────────────
    addToCart(product: Product) {
        const existing = this.cart.find(i => i.product.id === product.id);
        if (existing) {
            existing.quantity++;
        } else {
            this.cart.push({ product, quantity: 1 });
        }
    }

    removeOne(productId: number) {
        const idx = this.cart.findIndex(i => i.product.id === productId);
        if (idx === -1) return;
        if (this.cart[idx].quantity > 1) {
            this.cart[idx].quantity--;
        } else {
            this.cart.splice(idx, 1);
        }
    }

    removeItem(productId: number) {
        this.cart = this.cart.filter(i => i.product.id !== productId);
    }

    getQuantity(productId: number): number {
        return this.cart.find(i => i.product.id === productId)?.quantity ?? 0;
    }

    get total(): number {
        return this.cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    }

    get totalItems(): number {
        return this.cart.reduce((sum, i) => sum + i.quantity, 0);
    }

    clearCart() {
  this.cart = [];
  this.selectedEntradas = []; // ← agregar
}

    // ── Flujo de venta ───────────────────────────────────────
    openConfirm() {
        if (this.cart.length === 0) return;
        this.showConfirmModal = true;
    }

    async confirmarYEnviar() {
        this.procesando = true;
        try {
            const body = {
                tableNumber: 0,
                mealType: this.mealType,
                waiterName: 'Caja',
                status: 'Enviado a cocina',
                total: this.total,
                entradas: this.entradasText,
                items: this.cart.map(i => ({
                    productId: i.product.id,
                    quantity: i.quantity,
                    unitPrice: i.product.price
                }))
            };

            const orden: any = await this.http.post(`${this.apiUrl}/order`, body).toPromise();
            this.ordenCreadaId = orden.id;
            this.showConfirmModal = false;
            this.showCobrarModal = true;
        } catch (e) {
            alert('Error al crear la orden');
        } finally {
            this.procesando = false;
        }
    }

    async cobrarOrden() {
        if (!this.ordenCreadaId) return;
        this.procesando = true;
        try {
            await this.http.post(`${this.apiUrl}/transaction/cobrar`, {
                orderId: this.ordenCreadaId,
                paymentMethod: this.selectedPaymentMethod
            }).toPromise();

            this.successMessage = `✓ Venta registrada · ${this.selectedPaymentMethod} · S/. ${this.total.toFixed(2)}`;
            this.showCobrarModal = false;
            this.clearCart();
            this.ordenCreadaId = null;
            this.selectedPaymentMethod = 'Efectivo';

            setTimeout(() => this.successMessage = '', 4000);
        } catch (e) {
            alert('Error al cobrar la orden');
        } finally {
            this.procesando = false;
        }
    }

    // ── Helpers ──────────────────────────────────────────────
    getPaymentIcon(method: string): string {
        const icons: Record<string, string> = {
            'Efectivo': '💵', 'Tarjeta': '💳', 'Yape': '📱', 'Plin': '📲'
        };
        return icons[method] || '💰';
    }

    getCategoryName(id: number | null): string {
        if (id === null) return 'Todos';
        return this.categories.find(c => c.id === id)?.name ?? '';
    }
}