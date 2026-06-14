import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import QRCode from 'qrcode';

// ─── INTERFACES ───
interface Category { id: number; name: string; description: string; sortOrder: number; productCount: number; }
interface Product { id: number; name: string; description: string; price: number; imageUrl: string; isActive: boolean; categoryId: number; categoryName: string; }
interface UnsplashPhoto { id: string; urls: { small: string; regular: string }; alt_description: string; user: { name: string }; links: { download_location: string }; }
interface DailyEntrada { id: number; name: string; date: string; isActive: boolean; createdAt: string; }
export interface MenuDelDiaItem { id?: number; categoria: string; nombre: string; descripcion: string; precio: number; tag: string; esDestacado: boolean; orden: number; }

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit, AfterViewInit {
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;
  
  menuPublicoUrl = 'https://menus-comoencasa.netlify.app/';

  previewHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  
  private apiUrl = environment.apiUrl;
  private unsplashKey = 'GZOeZzgY8sguV5Lb_exuWp4_nqvGfLD6T5eSQARgGpU';

  activeTab: 'categories' | 'products' | 'entradas' | 'menuQr' = 'categories';

  // ─── CATEGORÍAS ───
  categories: Category[] = [];
  showCategoryModal = false;
  editingCategory: Category | null = null;
  categoryForm = { name: '', description: '', sortOrder: 0 };
  categoryError = '';

  // ─── PRODUCTOS Y PAGINACIÓN ───
  products: Product[] = [];
  filteredProducts: Product[] = []; // Ahora es un arreglo real
  paginatedProducts: Product[] = []; // Ahora es un arreglo real

  private _searchTerm: string = '';
  get searchTerm(): string { return this._searchTerm; }
  set searchTerm(value: string) {
    this._searchTerm = value;
    this.currentPage = 1; 
    this.updateTable(); // Solo actualiza la tabla cuando escribes
  }
  
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 15, 20];

  // Calcula el total de páginas
  get totalPages(): number {
    return Math.ceil(this.filteredProducts.length / this.pageSize) || 1;
  }

  // Método maestro para actualizar los arreglos sin romper el HTML
  updateTable() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredProducts = [...this.products];
    } else {
      this.filteredProducts = this.products.filter(p => 
        p.name.toLowerCase().includes(term) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedProducts = this.filteredProducts.slice(startIndex, startIndex + this.pageSize);
  }

  // Métodos para los botones de paginación
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateTable(); 
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateTable(); 
    }
  }

  onPageSizeChange(newSize: any) {
    this.pageSize = Number(newSize);
    this.currentPage = 1;
    this.updateTable();
  }

  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '', description: '', price: 0,
    categoryId: 0, imageUrl: '', isActive: true
  };
  productError = '';

  // ─── UNSPLASH ───
  unsplashQuery = '';
  unsplashResults: UnsplashPhoto[] = [];
  unsplashLoading = false;
  unsplashSearched = false;

  // ─── ENTRADAS DEL DÍA ───
  entradas: DailyEntrada[] = [];
  newEntradaName = '';
  entradaError = '';
  entradaLoading = false;
  editingEntrada: DailyEntrada | null = null;
  editEntradaName = '';

  // ─── MENÚ QR ───
  menuQrItems: MenuDelDiaItem[] = [];
  menuQrLoading = false;
  qrCategories = ['Entradas', 'Platos de fondo', 'Postres', 'Bebidas', 'Duos'];
  qrTags = ['', 'Vegetariano', 'Mariscos', 'Chef recomienda'];

  showQrItemModal = false;
  qrItemModalCat = '';
  editingQrItem: MenuDelDiaItem | null = null;
  qrItemForm = { nombre: '', descripcion: '', precio: 0, tag: '', esDestacado: false };

  // UI
  loading = false;
  deleteConfirm: { type: 'category' | 'product'; id: number; name: string } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();
    this.loadEntradas();
    this.loadMenuQr(); 
  }

  ngAfterViewInit() {
    setTimeout(() => this.generateQr(), 100);
  }

  // ─── LÓGICA CATEGORÍAS ───
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

  // ─── LÓGICA PRODUCTOS ───
  loadProducts() {
    this.http.get<Product[]>(`${this.apiUrl}/product`).subscribe({
      next: (data) => {
        this.products = data;
        this.updateTable(); // Inicia la paginación con los datos reales
      },
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

  // ─── LÓGICA UNSPLASH ───
  searchUnsplash() {
    if (!this.unsplashQuery.trim()) return;
    
    this.unsplashLoading = true;
    this.unsplashSearched = true;
    this.unsplashResults = []; // Limpiamos resultados previos
    
    const headers = new HttpHeaders({ Authorization: `Client-ID ${this.unsplashKey}` });
    
    // Agregamos un término general en inglés para asegurar que siempre haya resultados
    const query = this.traducirPlato(this.unsplashQuery) + " food dish";
    
    this.http.get<any>(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&orientation=landscape`,
      { headers }
    ).subscribe({
      next: (res) => { 
        this.unsplashResults = res.results; 
        this.unsplashLoading = false; 
      },
      error: (err) => { 
        console.error('Error en Unsplash:', err);
        this.unsplashLoading = false;
        // Si el error es 403, significa que agotaste tus 50 peticiones gratuitas diarias
        if (err.status === 403) {
          alert("Has alcanzado el límite de búsquedas gratuitas de Unsplash por hoy.");
        }
      }
    });
  }

  private traducirPlato(query: string): string {
  const dict: Record<string, string> = {
    'tallarines': 'noodles pasta',
    'arroz': 'rice',
    'pollo': 'chicken',
    'ceviche': 'ceviche peruvian',
    'lomo': 'beef steak',
    'causa': 'causa peruvian potato',
    'ají de gallina': 'peruvian chicken stew',
    'anticuchos': 'beef skewers',
    'chicharrón': 'fried pork',
    'seco': 'braised meat stew',
    'estofado': 'beef stew',
    'sudado': 'fish stew',
    'tacu tacu': 'peruvian beans rice',
    'mazamorra': 'peruvian pudding',
    'picarones': 'peruvian donuts',
    'suspiro': 'peruvian dessert cream',
    'chicha': 'peruvian drink',
    'emoliente': 'herbal drink',
    'papa': 'potato',
    'yuca': 'cassava',
    'chancho': 'pork',
    'pato': 'duck',
    'trucha': 'trout',
    'camarones': 'shrimp',
    'mariscos': 'seafood',
    'pulpo': 'octopus',
  };

  let traducido = query.toLowerCase().trim();
  for (const [es, en] of Object.entries(dict)) {
    if (traducido.includes(es)) {
      traducido = traducido.replace(es, en);
    }
  }
  return traducido;
}

  selectPhoto(photo: UnsplashPhoto) {
    this.productForm.imageUrl = photo.urls.regular;
    const headers = new HttpHeaders({ Authorization: `Client-ID ${this.unsplashKey}` });
    this.http.get(photo.links.download_location, { headers }).subscribe();
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || '';
  }

  // ─── LÓGICA ENTRADAS DEL DÍA ───
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

  // ─── LÓGICA MENÚ QR ───
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
  
  refreshPreview() {}
  
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

  switchToQrTab() {
    this.activeTab = 'menuQr';
    setTimeout(() => this.generateQr(), 80);
  }

  // ─── LÓGICA MODAL PLATO QR ───
  getCatIcon(cat: string): string {
    const icons: Record<string, string> = {
      'Entradas': '🥗',
      'Platos de fondo': '🍽️',
      'Postres': '🍮',
      'Bebidas': '🥤',
      'Duos': '🤝'
    };
    return icons[cat] || '🍴';
  }

  openQrItemModal(cat: string, item?: MenuDelDiaItem) {
    this.qrItemModalCat = cat;
    if (item) {
      this.editingQrItem = item;
      this.qrItemForm = {
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        tag: item.tag,
        esDestacado: item.esDestacado
      };
    } else {
      this.editingQrItem = null;
      this.qrItemForm = { nombre: '', descripcion: '', precio: 0, tag: '', esDestacado: false };
    }
    this.showQrItemModal = true;
  }

  closeQrItemModal() {
    this.showQrItemModal = false;
    this.editingQrItem = null;
  }

  saveQrItem() {
    if (!this.qrItemForm.nombre.trim()) return;

    if (this.editingQrItem) {
      this.editingQrItem.nombre = this.qrItemForm.nombre;
      this.editingQrItem.descripcion = this.qrItemForm.descripcion;
      this.editingQrItem.precio = this.qrItemForm.precio;
      this.editingQrItem.tag = this.qrItemForm.tag;
      this.editingQrItem.esDestacado = this.qrItemForm.esDestacado;
    } else {
      this.menuQrItems.push({
        categoria: this.qrItemModalCat,
        nombre: this.qrItemForm.nombre,
        descripcion: this.qrItemForm.descripcion,
        precio: this.qrItemForm.precio,
        tag: this.qrItemForm.tag,
        esDestacado: this.qrItemForm.esDestacado,
        orden: this.getMenuQrItems(this.qrItemModalCat).length + 1
      });
    }

    this.refreshPreview();
    this.closeQrItemModal();
  }
}