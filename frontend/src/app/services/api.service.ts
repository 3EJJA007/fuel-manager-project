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

  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }

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

  getDeliveries(filters: any = {}): Observable<any[]> {
    const params = new URLSearchParams();
    if (filters.stationId) params.append('stationId', filters.stationId);
    if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
    if (filters.carburantId) params.append('carburantId', filters.carburantId);
    if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
    if (filters.dateFin) params.append('dateFin', filters.dateFin);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/deliveries${qs}`, { headers: this.getHeaders() });
  }

  createDelivery(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/deliveries`, data, { headers: this.getHeaders() });
  }

  getSales(filters: any = {}): Observable<any[]> {
    const params = new URLSearchParams();
    if (filters.stationId) params.append('stationId', filters.stationId);
    if (filters.carburantId) params.append('carburantId', filters.carburantId);
    if (filters.employeId) params.append('employeId', filters.employeId);
    if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
    if (filters.dateFin) params.append('dateFin', filters.dateFin);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/sales${qs}`, { headers: this.getHeaders() });
  }

  createSale(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/sales`, data, { headers: this.getHeaders() });
  }

  getDashboard(stationId?: number): Observable<any> {
    const url = stationId ? `${this.baseUrl}/stats/dashboard?stationId=${stationId}` : `${this.baseUrl}/stats/dashboard`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getStockSummary(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/stats/stock-summary?stationId=${stationId}` : `${this.baseUrl}/stats/stock-summary`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getMovements(filters: any = {}): Observable<any[]> {
    const params = new URLSearchParams();
    if (filters.stationId) params.append('stationId', filters.stationId);
    if (filters.type) params.append('type', filters.type);
    if (filters.carburantId) params.append('carburantId', filters.carburantId);
    if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
    if (filters.dateFin) params.append('dateFin', filters.dateFin);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/stats/movements${qs}`, { headers: this.getHeaders() });
  }

  getDailySales(days: number = 7, stationId?: number): Observable<any[]> {
    let url = `${this.baseUrl}/stats/daily-sales?days=${days}`;
    if (stationId) url += `&stationId=${stationId}`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getSalesByFuel(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/stats/sales-by-fuel?stationId=${stationId}` : `${this.baseUrl}/stats/sales-by-fuel`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getAlerts(stationId?: number, traitee?: boolean): Observable<any[]> {
    let url = `${this.baseUrl}/alerts`;
    const params = new URLSearchParams();
    if (stationId) params.append('stationId', stationId.toString());
    if (traitee !== undefined) params.append('traitee', traitee.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${url}${qs}`, { headers: this.getHeaders() });
  }

  treatAlert(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/alerts/${id}/traiter`, {}, { headers: this.getHeaders() });
  }

  getLowStockStations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/alerts/low-stock-stations`, { headers: this.getHeaders() });
  }

  getNotifications(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/notifications`, { headers: this.getHeaders() });
  }

  markNotificationRead(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/notifications/${id}/read`, {}, { headers: this.getHeaders() });
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.put(`${this.baseUrl}/notifications/read-all`, {}, { headers: this.getHeaders() });
  }

  getReports(stationId?: number): Observable<any[]> {
    const url = stationId ? `${this.baseUrl}/reports?stationId=${stationId}` : `${this.baseUrl}/reports`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  generateReport(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/reports/generate`, data, { headers: this.getHeaders() });
  }

  getReportExportUrl(id: number, format: string = 'CSV'): string {
    return `${this.baseUrl}/reports/${id}/export?format=${format}`;
  }
}
