import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  api = inject(ApiService);

  // State signals
  currentUser = signal<any>(null);
  activePage = signal<string>('dashboard');
  theme = signal<string>(localStorage.getItem('fm_theme') || 'dark');
  toastMessage = signal<string>('');
  toastType = signal<string>('info');
  showToast = signal<boolean>(false);
  authTab = signal<'login' | 'register'>('login');

  // Auth Form
  authNom = '';
  authPrenom = '';
  authEmail = '';
  authPassword = '';
  authError = '';

  // Data cache
  dashboardData = signal<any>(null);
  stockSummary = signal<any[]>([]);
  stations = signal<any[]>([]);
  fuels = signal<any[]>([]);
  pumps = signal<any[]>([]);
  tanks = signal<any[]>([]);
  suppliers = signal<any[]>([]);
  deliveries = signal<any[]>([]);
  sales = signal<any[]>([]);
  users = signal<any[]>([]);
  movements = signal<any[]>([]);

  // POS Caisse State
  selectedPumpId: number | null = null;
  posQuantity: number = 20;
  posPayment: string = 'Espèces';
  posError: string = '';
  activeReceipt = signal<any>(null);

  // Modal State
  activeModal = signal<string | null>(null);
  modalTitle = signal<string>('');
  modalData: any = {};
  modalError: string = '';

  // Roles map
  rolesMap: Record<string, string> = {
    admin: 'Administrateur',
    gerant: 'Gérant de station',
    employe: 'Employé'
  };

  ngOnInit() {
    this.applyTheme(this.theme());
    this.checkSession();
  }

  // Toast
  notify(msg: string, type: 'info' | 'success' | 'error' = 'info') {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3200);
  }

  // Theme
  toggleTheme() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem('fm_theme', next);
    this.applyTheme(next);
  }

  private applyTheme(t: string) {
    document.documentElement.setAttribute('data-theme', t);
  }

  // Check login
  checkSession() {
    const token = this.api.getToken();
    if (!token) return;

    this.api.getMe().subscribe({
      next: (res) => {
        this.currentUser.set(res.user);
        this.setDefaultPage(res.user.role);
        this.loadCurrentPageData();
      },
      error: () => {
        this.api.setToken(null);
        this.currentUser.set(null);
      }
    });
  }

  setDefaultPage(role: string) {
    if (role === 'employe') this.activePage.set('pos');
    else this.activePage.set('dashboard');
  }

  setPage(page: string) {
    this.activePage.set(page);
    this.loadCurrentPageData();
  }

  // Auth Submit
  submitAuth() {
    this.authError = '';
    if (this.authTab() === 'login') {
      this.api.login(this.authEmail.trim(), this.authPassword).subscribe({
        next: (res) => {
          this.api.setToken(res.token);
          this.currentUser.set(res.user);
          this.notify(`Bienvenue ${res.user.prenom || res.user.nom} !`, 'success');
          this.setDefaultPage(res.user.role);
          this.loadCurrentPageData();
        },
        error: (err) => {
          this.authError = err.error?.message || 'Identifiants incorrects.';
        }
      });
    } else {
      const data = {
        nom: this.authNom.trim(),
        prenom: this.authPrenom.trim(),
        email: this.authEmail.trim(),
        motDePasse: this.authPassword
      };
      this.api.register(data).subscribe({
        next: (res) => {
          this.api.setToken(res.token);
          this.currentUser.set(res.user);
          this.notify('Compte créé avec succès !', 'success');
          this.setDefaultPage(res.user.role);
          this.loadCurrentPageData();
        },
        error: (err) => {
          this.authError = err.error?.message || 'Erreur lors de l’inscription.';
        }
      });
    }
  }

  fillDemo(email: string, pass: string) {
    this.authEmail = email;
    this.authPassword = pass;
    this.authError = '';
  }

  logout() {
    this.api.setToken(null);
    this.currentUser.set(null);
    this.activePage.set('dashboard');
    this.notify('Déconnexion effectuée.');
  }

  // Load Data according to Page
  loadCurrentPageData() {
    const user = this.currentUser();
    if (!user) return;
    const sId = user.stationId || undefined;

    const page = this.activePage();
    if (page === 'dashboard') {
      this.api.getDashboard(sId).subscribe(d => this.dashboardData.set(d));
      this.api.getStockSummary(sId).subscribe(s => this.stockSummary.set(s));
    } else if (page === 'stations') {
      this.api.getStations().subscribe(s => this.stations.set(s));
    } else if (page === 'fuels') {
      this.api.getFuels().subscribe(f => this.fuels.set(f));
    } else if (page === 'pumps') {
      this.api.getPumps(sId).subscribe(p => this.pumps.set(p));
      this.api.getFuels().subscribe(f => this.fuels.set(f));
      this.api.getStations().subscribe(s => this.stations.set(s));
    } else if (page === 'tanks' || page === 'stock') {
      this.api.getTanks(sId).subscribe(t => this.tanks.set(t));
      this.api.getFuels().subscribe(f => this.fuels.set(f));
      this.api.getStations().subscribe(s => this.stations.set(s));
      this.api.getMovements(sId).subscribe(m => this.movements.set(m));
    } else if (page === 'suppliers') {
      this.api.getSuppliers().subscribe(s => this.suppliers.set(s));
    } else if (page === 'deliveries') {
      this.api.getDeliveries(sId).subscribe(d => this.deliveries.set(d));
      this.api.getSuppliers().subscribe(s => this.suppliers.set(s));
      this.api.getTanks(sId).subscribe(t => this.tanks.set(t));
      this.api.getFuels().subscribe(f => this.fuels.set(f));
      this.api.getStations().subscribe(s => this.stations.set(s));
    } else if (page === 'sales') {
      this.api.getSales(sId).subscribe(s => this.sales.set(s));
    } else if (page === 'pos') {
      this.api.getPumps(sId).subscribe(p => {
        const active = p.filter((x: any) => x.etat === 'En service');
        this.pumps.set(active);
        if (active.length > 0 && !this.selectedPumpId) {
          this.selectedPumpId = active[0].id;
        }
      });
    } else if (page === 'users') {
      this.api.getUsers().subscribe(u => this.users.set(u));
      this.api.getStations().subscribe(s => this.stations.set(s));
    }
  }

  // POS Calculations
  getSelectedPump() {
    return this.pumps().find(p => p.id === this.selectedPumpId);
  }

  getCalculatedAmount(): number {
    const pump = this.getSelectedPump();
    if (!pump || !pump.carburant) return 0;
    return Number((this.posQuantity * pump.carburant.prixUnitaire).toFixed(3));
  }

  submitPOSSale() {
    this.posError = '';
    if (!this.selectedPumpId) {
      this.posError = 'Veuillez sélectionner une pompe.';
      return;
    }
    if (this.posQuantity <= 0) {
      this.posError = 'Quantité positive requise.';
      return;
    }

    const payload = {
      pompeId: this.selectedPumpId,
      quantite: this.posQuantity,
      modePaiement: this.posPayment
    };

    this.api.createSale(payload).subscribe({
      next: (res) => {
        this.notify(`Vente validée (${res.sale.montant} DT) !`, 'success');
        this.activeReceipt.set(res.sale);
      },
      error: (err) => {
        this.posError = err.error?.message || 'Erreur lors de la vente.';
      }
    });
  }

  printReceipt() {
    window.print();
  }

  // Modals Management
  openModal(type: string, data: any = {}) {
    this.activeModal.set(type);
    this.modalError = '';
    this.modalData = { ...data };

    if (type === 'station') this.modalTitle.set(data.id ? 'Modifier la Station' : 'Nouvelle Station');
    else if (type === 'fuel') this.modalTitle.set(data.id ? 'Modifier le Carburant & Tarif' : 'Nouveau Carburant');
    else if (type === 'pump') this.modalTitle.set(data.id ? 'Modifier la Pompe' : 'Nouvelle Pompe');
    else if (type === 'tank') this.modalTitle.set(data.id ? 'Modifier la Cuve' : 'Nouvelle Cuve');
    else if (type === 'supplier') this.modalTitle.set(data.id ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur');
    else if (type === 'delivery') this.modalTitle.set('Enregistrer une Livraison de Carburant');
    else if (type === 'user') this.modalTitle.set('Créer un Nouvel Utilisateur');
  }

  closeModal() {
    this.activeModal.set(null);
  }

  saveModal() {
    this.modalError = '';
    const type = this.activeModal();
    const d = this.modalData;

    if (type === 'station') {
      const call = d.id ? this.api.updateStation(d.id, d) : this.api.createStation(d);
      call.subscribe({
        next: () => { this.notify('Station enregistrée !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'fuel') {
      const call = d.id ? this.api.updateFuel(d.id, d) : this.api.createFuel(d);
      call.subscribe({
        next: () => { this.notify('Carburant enregistré !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'pump') {
      const call = d.id ? this.api.updatePump(d.id, d) : this.api.createPump(d);
      call.subscribe({
        next: () => { this.notify('Pompe enregistrée !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'tank') {
      const call = d.id ? this.api.updateTank(d.id, d) : this.api.createTank(d);
      call.subscribe({
        next: () => { this.notify('Cuve enregistrée !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'supplier') {
      const call = d.id ? this.api.updateSupplier(d.id, d) : this.api.createSupplier(d);
      call.subscribe({
        next: () => { this.notify('Fournisseur enregistré !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'delivery') {
      this.api.createDelivery(d).subscribe({
        next: (res) => { this.notify(`Livraison enregistrée ! (${res.message})`, 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    } else if (type === 'user') {
      this.api.createUser(d).subscribe({
        next: () => { this.notify('Utilisateur créé avec succès !', 'success'); this.closeModal(); this.loadCurrentPageData(); },
        error: (err) => this.modalError = err.error?.message || 'Erreur.'
      });
    }
  }

  // Deletions
  deleteItem(type: string, id: number) {
    if (!confirm('Supprimer définitivement cet élément ?')) return;

    let call;
    if (type === 'station') call = this.api.deleteStation(id);
    else if (type === 'fuel') call = this.api.deleteFuel(id);
    else if (type === 'pump') call = this.api.deletePump(id);
    else if (type === 'tank') call = this.api.deleteTank(id);
    else if (type === 'supplier') call = this.api.deleteSupplier(id);
    else if (type === 'user') call = this.api.deleteUser(id);

    if (call) {
      call.subscribe({
        next: () => { this.notify('Élément supprimé.', 'success'); this.loadCurrentPageData(); },
        error: (err) => this.notify(err.error?.message || 'Erreur lors de la suppression.', 'error')
      });
    }
  }

  // Users update role/station
  updateUserRole(userId: number, role: string) {
    this.api.updateUser(userId, { role }).subscribe({
      next: () => this.notify('Rôle mis à jour !', 'success'),
      error: (err) => { this.notify(err.error?.message || 'Erreur.', 'error'); this.loadCurrentPageData(); }
    });
  }

  updateUserStation(userId: number, stationId: any) {
    this.api.updateUser(userId, { stationId: stationId ? Number(stationId) : null }).subscribe({
      next: () => this.notify('Affectation station mise à jour !', 'success'),
      error: (err) => { this.notify(err.error?.message || 'Erreur.', 'error'); this.loadCurrentPageData(); }
    });
  }

  // Profile update
  updateProfile() {
    this.api.updateProfile(this.currentUser()).subscribe({
      next: (res) => { this.currentUser.set(res.user); this.notify('Profil mis à jour !', 'success'); },
      error: (err) => this.notify(err.error?.message || 'Erreur de mise à jour.', 'error')
    });
  }

  // Reset Demo
  resetDemo() {
    if (!confirm('Réinitialiser la base PostgreSQL aux données de départ ?')) return;
    this.api.resetDemo().subscribe({
      next: () => { this.notify('Données PostgreSQL réinitialisées !', 'success'); this.loadCurrentPageData(); },
      error: (err) => this.notify(err.error?.message || 'Erreur.', 'error')
    });
  }
}
