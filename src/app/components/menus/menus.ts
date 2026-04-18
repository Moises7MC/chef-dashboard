import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';

interface Category {
  id: number;
  name: string;
  description: string;
  sortOrder: number;
  productCount: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  categoryId: number;
  categoryName: string;
}

interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string;
  user: { name: string };
  links: { download_location: string };
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit {
  private apiUrl = 'http://localhost:5245/api';
  private unsplashKey = 'GZOeZzgY8sguV5Lb_exuWp4_nqvGfLD6T5eSQARgGpU';

  activeTab: 'categories' | 'products' = 'categories';

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

  // UI
  loading = false;
  deleteConfirm: { type: 'category' | 'product'; id: number; name: string } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();
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
    // Trigger download como requiere Unsplash
    const headers = new HttpHeaders({ Authorization: `Client-ID ${this.unsplashKey}` });
    this.http.get(photo.links.download_location, { headers }).subscribe();
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || '';
  }
}