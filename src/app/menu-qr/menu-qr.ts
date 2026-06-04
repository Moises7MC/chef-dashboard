import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment'; // Ajusta la ruta a tu environment

export interface MenuDelDiaItem {
  id: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number;
  tag: string;
  esDestacado: boolean;
  orden: number;
}

@Component({
  selector: 'app-menu-qr',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './menu-qr.html',
  styleUrls: ['./menu-qr.css']
})
export class MenuQrComponent implements OnInit {
  private apiUrl = environment.apiUrl;
  
  menuItems: MenuDelDiaItem[] = [];
  fechaHoy: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.generarFecha();
    this.cargarMenu();
  }

  generarFecha() {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hoy = new Date();
    this.fechaHoy = `${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]}`;
  }

  cargarMenu() {
    this.http.get<MenuDelDiaItem[]>(`${this.apiUrl}/MenuDelDia`).subscribe({
      next: (data) => this.menuItems = data,
      error: (e) => console.error('Error cargando el menú público', e)
    });
  }

  // Filtra los platos según la categoría que el HTML pida
  getItems(categoria: string): MenuDelDiaItem[] {
    return this.menuItems.filter(item => item.categoria === categoria);
  }

  // Asigna el color exacto a la etiqueta según la opción elegida en el admin
  getTagClass(tag: string): string {
    if (tag === 'Vegetariano') return 'tag-v';
    if (tag === 'Mariscos') return 'tag-p';
    if (tag === 'Chef recomienda') return 'tag-s';
    return '';
  }
}