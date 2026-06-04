import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import QRCode from 'qrcode';

// Tus interfaces anteriores...
interface Category { id: number; name: string; description: string; sortOrder: number; productCount: number; }
interface Product { id: number; name: string; description: string; price: number; imageUrl: string; isActive: boolean; categoryId: number; categoryName: string; }
interface UnsplashPhoto { id: string; urls: { small: string; regular: string }; alt_description: string; user: { name: string }; links: { download_location: string }; }
interface DailyEntrada { id: number; name: string; date: string; isActive: boolean; createdAt: string; }

// NUEVA INTERFAZ PARA MENÚ QR
export interface MenuDelDiaItem {
  id?: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number;
  tag: string;
  esDestacado: boolean;
  orden: number;
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit {
@ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;
// menuPublicoUrl = 'http://localhost:4200/menu'
// menuPublicoUrl = 'http://192.168.18.82:4200/menu';
menuPublicoUrl = 'https://menus-comoencasa.netlify.app/';

previewHoy = new Date().toLocaleDateString('es-PE', {
  weekday: 'long', day: 'numeric', month: 'long'
});
  private apiUrl = environment.apiUrl;
  private unsplashKey = 'GZOeZzgY8sguV5Lb_exuWp4_nqvGfLD6T5eSQARgGpU';
  

  activeTab: 'categories' | 'products' | 'entradas' | 'menuQr' = 'categories';

  // Categorías
  categories: Category[] = [];
  showCategoryModal = false;
  editingCategory: Category | null = null;
  categoryForm = { name: '', description: '', sortOrder: 0 };
  categoryError = '';

  // Productos
  products: Product[] = [];
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '', description: '', price: 0,
    categoryId: 0, imageUrl: '', isActive: true
  };
  productError = '';

  // Unsplash
  unsplashQuery = '';
  unsplashResults: UnsplashPhoto[] = [];
  unsplashLoading = false;
  unsplashSearched = false;

  // Entradas del día
  entradas: DailyEntrada[] = [];
  newEntradaName = '';
  entradaError = '';
  entradaLoading = false;
  editingEntrada: DailyEntrada | null = null;
  editEntradaName = '';

  // ─── NUEVO: VARIABLES MENÚ QR ───
  menuQrItems: MenuDelDiaItem[] = [];
  menuQrLoading = false;
  qrCategories = ['Entradas', 'Platos de fondo', 'Postres', 'Bebidas', 'Duos'];
  qrTags = ['', 'Vegetariano', 'Mariscos', 'Chef recomienda'];

  // UI
  loading = false;
  deleteConfirm: { type: 'category' | 'product'; id: number; name: string } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();
    this.loadEntradas();
    this.loadMenuQr(); // Cargamos el menú QR al inicio
  }

  // ─── CATEGORÍAS ──────────────────────────────────────────────
  loadCategories() {
    this.http.get<Category[]>(`${this.apiUrl}/category`).subscribe({
      next: (data) => this.categories = data,
      error: (e) => console.error(e)
    });
  }

  openCategoryModal(cat?: Category) {
    this.categoryError = '';
    if (cat) {
      this.editingCategory = cat;
      this.categoryForm = { name: cat.name, description: cat.description, sortOrder: cat.sortOrder };
    } else {
      this.editingCategory = null;
      this.categoryForm = { name: '', description: '', sortOrder: this.categories.length + 1 };
    }
    this.showCategoryModal = true;
  }

  saveCategory() {
    if (!this.categoryForm.name.trim()) { this.categoryError = 'El nombre es requerido'; return; }
    this.loading = true;
    const body = this.categoryForm;
    const req = this.editingCategory
      ? this.http.put(`${this.apiUrl}/category/${this.editingCategory.id}`, body)
      : this.http.post(`${this.apiUrl}/category`, body);

    req.subscribe({
      next: () => { this.showCategoryModal = false; this.loadCategories(); this.loading = false; },
      error: (e) => { this.categoryError = e.error || 'Error al guardar'; this.loading = false; }
    });
  }

  confirmDelete(type: 'category' | 'product', id: number, name: string) {
    this.deleteConfirm = { type, id, name };
  }

  executeDelete() {
    if (!this.deleteConfirm) return;
    const { type, id } = this.deleteConfirm;
    const url = type === 'category' ? `${this.apiUrl}/category/${id}` : `${this.apiUrl}/product/${id}`;
    this.http.delete(url).subscribe({
      next: () => {
        this.deleteConfirm = null;
        type === 'category' ? this.loadCategories() : this.loadProducts();
      },
      error: (e) => { alert(e.error || 'No se puede eliminar'); this.deleteConfirm = null; }
    });
  }

  // ─── PRODUCTOS ────────────────────────────────────────────────
  loadProducts() {
    this.http.get<Product[]>(`${this.apiUrl}/product`).subscribe({
      next: (data) => this.products = data,
      error: (e) => console.error(e)
    });
  }

  openProductModal(product?: Product) {
    this.productError = '';
    this.unsplashResults = [];
    this.unsplashSearched = false;
    this.unsplashQuery = '';
    if (product) {
      this.editingProduct = product;
      this.productForm = {
        name: product.name, description: product.description,
        price: product.price, categoryId: product.categoryId,
        imageUrl: product.imageUrl, isActive: product.isActive
      };
      this.unsplashQuery = product.name;
    } else {
      this.editingProduct = null;
      this.productForm = { name: '', description: '', price: 0, categoryId: this.categories[0]?.id || 0, imageUrl: '', isActive: true };
    }
    this.showProductModal = true;
  }

  saveProduct() {
    if (!this.productForm.name.trim()) { this.productError = 'El nombre es requerido'; return; }
    if (this.productForm.price <= 0) { this.productError = 'El precio debe ser mayor a 0'; return; }
    if (!this.productForm.categoryId) { this.productError = 'Selecciona una categoría'; return; }
    this.loading = true;
    const req = this.editingProduct
      ? this.http.put(`${this.apiUrl}/product/${this.editingProduct.id}`, this.productForm)
      : this.http.post(`${this.apiUrl}/product`, this.productForm);

    req.subscribe({
      next: () => { this.showProductModal = false; this.loadProducts(); this.loading = false; },
      error: (e) => { this.productError = e.error || 'Error al guardar'; this.loading = false; }
    });
  }

  toggleActive(product: Product) {
    this.http.put(`${this.apiUrl}/product/${product.id}/toggle-active`, {}).subscribe({
      next: () => this.loadProducts(),
      error: (e) => console.error(e)
    });
  }

  // ─── UNSPLASH ─────────────────────────────────────────────────
  searchUnsplash() {
    if (!this.unsplashQuery.trim()) return;
    this.unsplashLoading = true;
    this.unsplashSearched = true;
    const headers = new HttpHeaders({ Authorization: `Client-ID ${this.unsplashKey}` });
    this.http.get<any>(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(this.unsplashQuery + ' comida plato')}&per_page=9&orientation=landscape`,
      { headers }
    ).subscribe({
      next: (res) => { this.unsplashResults = res.results; this.unsplashLoading = false; },
      error: () => { this.unsplashLoading = false; }
    });
  }

  selectPhoto(photo: UnsplashPhoto) {
    this.productForm.imageUrl = photo.urls.regular;
    const headers = new HttpHeaders({ Authorization: `Client-ID ${this.unsplashKey}` });
    this.http.get(photo.links.download_location, { headers }).subscribe();
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || '';
  }

  // ─── ENTRADAS DEL DÍA ─────────────────────────────────────────
  loadEntradas() {
    this.http.get<DailyEntrada[]>(`${this.apiUrl}/entrada`).subscribe({
      next: (data) => this.entradas = data,
      error: (e) => console.error(e)
    });
  }

  addEntrada() {
    if (!this.newEntradaName.trim()) {
      this.entradaError = 'Escribe un nombre para la entrada';
      return;
    }
    this.entradaLoading = true;
    this.entradaError = '';
    this.http.post<DailyEntrada>(`${this.apiUrl}/entrada`, { name: this.newEntradaName.trim() }).subscribe({
      next: (nueva) => {
        this.entradas.push(nueva);
        this.newEntradaName = '';
        this.entradaLoading = false;
      },
      error: () => { this.entradaError = 'Error al agregar entrada'; this.entradaLoading = false; }
    });
  }

  startEditEntrada(entrada: DailyEntrada) {
    this.editingEntrada = entrada;
    this.editEntradaName = entrada.name;
  }

  saveEditEntrada() {
    if (!this.editingEntrada || !this.editEntradaName.trim()) return;
    this.http.put<DailyEntrada>(`${this.apiUrl}/entrada/${this.editingEntrada.id}`, { name: this.editEntradaName.trim() }).subscribe({
      next: (updated) => {
        const idx = this.entradas.findIndex(e => e.id === updated.id);
        if (idx !== -1) this.entradas[idx] = updated;
        this.editingEntrada = null;
        this.editEntradaName = '';
      },
      error: () => { this.entradaError = 'Error al editar'; }
    });
  }

  cancelEditEntrada() {
    this.editingEntrada = null;
    this.editEntradaName = '';
  }

  deleteEntrada(entrada: DailyEntrada) {
    this.http.delete(`${this.apiUrl}/entrada/${entrada.id}`).subscribe({
      next: () => this.entradas = this.entradas.filter(e => e.id !== entrada.id),
      error: () => { this.entradaError = 'Error al eliminar'; }
    });
  }

  getTodayLabel(): string {
    return new Date().toLocaleDateString('es-PE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // ─── NUEVO: GESTIÓN DE MENÚ QR ────────────────────────────────
  loadMenuQr() {
    this.http.get<MenuDelDiaItem[]>(`${this.apiUrl}/MenuDelDia`).subscribe({
      next: (data) => this.menuQrItems = data,
      error: (e) => console.error('Error cargando menú QR', e)
    });
  }

  getMenuQrItems(categoria: string): MenuDelDiaItem[] {
    return this.menuQrItems.filter(m => m.categoria === categoria);
  }

  addMenuQrItem(categoria: string) {
    this.menuQrItems.push({
      categoria: categoria,
      nombre: '',
      descripcion: '',
      precio: 0,
      tag: '',
      esDestacado: false,
      orden: this.getMenuQrItems(categoria).length + 1
    });
  }

  removeMenuQrItem(item: MenuDelDiaItem) {
    this.menuQrItems = this.menuQrItems.filter(m => m !== item);
  }

  saveMenuQr() {
    this.menuQrLoading = true;
    
    // Recalcular orden para garantizar limpieza
    let ordenGlobal = 1;
    this.qrCategories.forEach(cat => {
      this.getMenuQrItems(cat).forEach(item => {
        item.orden = ordenGlobal++;
      });
    });

    this.http.post(`${this.apiUrl}/MenuDelDia/bulk`, this.menuQrItems).subscribe({
      next: () => {
        alert('Menú QR guardado correctamente. Los cambios ya son visibles.');
        this.menuQrLoading = false;
        this.loadMenuQr();
      },
      error: (e) => {
        console.error(e);
        alert('Hubo un error al guardar el menú QR.');
        this.menuQrLoading = false;
      }
    });
  }

generateQr() {
  if (!this.qrCanvas?.nativeElement) return;
  QRCode.toCanvas(this.qrCanvas.nativeElement, this.menuPublicoUrl, {
    width: 200,
    margin: 2,
    color: { dark: '#1A1610', light: '#F7F2EA' }
  }, (err) => {
    if (err) console.error('Error generando QR:', err);
  });
}
 
/** Permite actualizar la preview en tiempo real cuando el usuario edita */
refreshPreview() {
  // Angular detecta el cambio automáticamente con ngModel,
  // este método existe para engancharlo con (ngModelChange) si necesitas lógica adicional
}
 
/** Descarga el QR como imagen PNG */
downloadQr() {
  QRCode.toDataURL(this.menuPublicoUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1A1610', light: '#F7F2EA' }
  }).then((url) => {
    const link = document.createElement('a');
    link.download = 'menu-qr-la-terraza.png';
    link.href = url;
    link.click();
  }).catch(err => console.error('Error generando QR:', err));
}
 
// 4. MODIFICA ngAfterViewInit para generar el QR al cargar
//    Si tu componente no tiene ngAfterViewInit, agrégalo y añade AfterViewInit en implements:
 
ngAfterViewInit() {
  // Espera un tick para que Angular renderice el canvas
  setTimeout(() => this.generateQr(), 100);
}
 
// 5. TAMBIÉN genera el QR cuando el usuario hace click en el tab menuQr.
//    Modifica la línea del tab en el HTML así:
//    (click)="activeTab = 'menuQr'; setTimeout(generateQr.bind(this), 50)"
//    O más limpio, crea este método y úsalo:
switchToQrTab() {
  this.activeTab = 'menuQr';
  setTimeout(() => this.generateQr(), 80);
}
 
// 6. En el HTML, cambia el botón del tab QR de:
//    (click)="activeTab = 'menuQr'"
// A:
//    (click)="switchToQrTab()"
}