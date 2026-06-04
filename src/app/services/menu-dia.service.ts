import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class MenuDiaService {
  // Ajusta la URL base según cómo la tengas en tu ApiService actual
  private apiUrl = `${environment.apiUrl}/MenuDelDia`; 

  constructor(private http: HttpClient) { }

  getMenuPublico(): Observable<MenuDelDiaItem[]> {
    return this.http.get<MenuDelDiaItem[]>(this.apiUrl);
  }

  updateFullMenu(nuevoMenu: MenuDelDiaItem[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/bulk`, nuevoMenu);
  }
}