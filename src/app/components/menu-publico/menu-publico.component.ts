import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';           // ← cambia esta
import { MenuDelDiaItem } from '../../components/menus/menus';             // ← y esta

@Component({
  selector: 'app-menu-publico',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './menu-publico.component.html',
  styleUrls: ['./menu-publico.component.css']
})
export class MenuPublicoComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  items: MenuDelDiaItem[] = [];
  loading = true;
  error = false;

  categorias = ['Entradas', 'Platos de fondo', 'Postres', 'Bebidas', 'Duos'];

  hoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<MenuDelDiaItem[]>(`${this.apiUrl}/MenuDelDia`).subscribe({
      next: (data) => {
        this.items = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  getItems(categoria: string): MenuDelDiaItem[] {
    return this.items.filter(i => i.categoria === categoria);
  }

  hasItems(categoria: string): boolean {
    return this.getItems(categoria).length > 0;
  }

  getCategoriaIcon(categoria: string): string {
    const icons: Record<string, string> = {
      'Entradas': '🥗',
      'Platos de fondo': '🍽️',
      'Postres': '🍮',
      'Bebidas': '🥤',
      'Duos': '👫'
    };
    return icons[categoria] || '🍴';
  }
}