import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api';
  private tokenKey = 'fm_jwt_token';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Health
  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }

  // Auth (US 1, 2, 3, 4)
  login(email: string, motDePasse: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { email, motDePasse });
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register`, data);
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/me`, { headers: this.getHeaders() });
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/auth/profile`, data, { headers: this.getHeaders() });
  }

  resetDemo(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/reset-demo`, {}, { headers: this.getHeaders() });
  }

  // Users & Roles (US 5)
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`, { headers: this.getHeaders() });
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, data, { headers: this.getHeaders() });
  }

  updateUser(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, data, { headers: this.getHeaders() });
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  // Stations (US 6, 7, 8, 9)
  getStations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/stations`, { headers: this.getHeaders() });
  }

  createStation(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/stations`, data, { headers: this.getHeaders() });
  }

  updateStation(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/stations/${id}`, data, { headers: this.getHeaders() });
  }

  deleteStation(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/stations/${id}`, { headers: this.getHeaders() });
  }

  // Fuels (US 10, 11, 12, 13, 30)
  getFuels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/fuels`, { headers: this.getHeaders() });
  }

  createFuel(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/fuels`, data, { headers: this.getHeaders() });
  }

  updateFuel(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/fuels/${id}`, data, { headers: this.getHeaders() });
  }

  deleteFuel(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/fuels/${id}`, { headers: this.getHeaders() });
  }

  // Pumps (US 14, 15, 16)
  getPumps(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/pumps?stationId=${stationId}` : `${this.baseUrl}/pumps`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  createPump(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/pumps`, data, { headers: this.getHeaders() });
  }

  updatePump(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/pumps/${id}`, data, { headers: this.getHeaders() });
  }

  deletePump(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/pumps/${id}`, { headers: this.getHeaders() });
  }

  // Tanks (US 17, 18, 19, 29)
  getTanks(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/tanks?stationId=${stationId}` : `${this.baseUrl}/tanks`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  createTank(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/tanks`, data, { headers: this.getHeaders() });
  }

  updateTank(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/tanks/${id}`, data, { headers: this.getHeaders() });
  }

  deleteTank(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/tanks/${id}`, { headers: this.getHeaders() });
  }

  // Suppliers (US 20, 21, 22, 23)
  getSuppliers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/suppliers`, { headers: this.getHeaders() });
  }

  createSupplier(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/suppliers`, data, { headers: this.getHeaders() });
  }

  updateSupplier(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/suppliers/${id}`, data, { headers: this.getHeaders() });
  }

  deleteSupplier(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/suppliers/${id}`, { headers: this.getHeaders() });
  }

  // Deliveries (US 24, 25)
  getDeliveries(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/deliveries?stationId=${stationId}` : `${this.baseUrl}/deliveries`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  createDelivery(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/deliveries`, data, { headers: this.getHeaders() });
  }

  // Sales (US 26, 27, 28)
  getSales(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/sales?stationId=${stationId}` : `${this.baseUrl}/sales`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  createSale(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/sales`, data, { headers: this.getHeaders() });
  }

  // Stats (US 29, 30)
  getDashboard(stationId?: number): Observable<any> {
    const url = stationId ? `${this.baseUrl}/stats/dashboard?stationId=${stationId}` : `${this.baseUrl}/stats/dashboard`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getStockSummary(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/stats/stock-summary?stationId=${stationId}` : `${this.baseUrl}/stats/stock-summary`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getMovements(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/stats/movements?stationId=${stationId}` : `${this.baseUrl}/stats/movements`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }
}
