// FUEL//MANAGER - Frontend Application Controller
// Sprint 1 & 2 Implementation
// Designed for ISET Charguia Integration Project (Mme Sonia Gannar)

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// State
const state = {
  user: null,
  page: 'dashboard',
  theme: localStorage.getItem('fm_theme') || 'dark',
  cache: {
    stations: [],
    fuels: [],
    pumps: [],
    tanks: [],
    suppliers: [],
    stockSummary: []
  }
};

// Role labels & icon mapping
const ROLES = {
  admin: 'Administrateur',
  gerant: 'Gérant de station',
  employe: 'Employé'
};

const ICONS = {
  dashboard: '📊',
  stations: '🏢',
  fuels: '🛢️',
  pumps: '⛽',
  tanks: '🧪',
  stock: '📈',
  suppliers: '🤝',
  deliveries: '🚚',
  sales: '💰',
  pos: '💳',
  users: '👥',
  profile: '👤'
};

// Navigation config per role
const NAV_CONFIG = {
  admin: [
    ['dashboard', 'Tableau de bord'],
    ['stations', 'Stations-service'],
    ['fuels', 'Carburants & Prix'],
    ['tanks', 'Cuves de stockage'],
    ['pumps', 'Pompes du réseau'],
    ['suppliers', 'Fournisseurs'],
    ['deliveries', 'Livraisons'],
    ['sales', 'Historique des ventes'],
    ['users', 'Utilisateurs & Rôles'],
    ['profile', 'Mon profil']
  ],
  gerant: [
    ['dashboard', 'Tableau de bord'],
    ['stock', 'Suivi du stock'],
    ['pumps', 'Pompes de la station'],
    ['tanks', 'Cuves de la station'],
    ['deliveries', 'Entrées de carburant'],
    ['sales', 'Ventes de la station'],
    ['profile', 'Mon profil']
  ],
  employe: [
    ['pos', 'Caisse & Vente rapide'],
    ['sales', 'Mes ventes du jour'],
    ['stock', 'Niveaux des cuves'],
    ['profile', 'Mon profil']
  ]
};

// Toast notification helper
function toast(msg, type = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = type === 'error' ? 'error' : type === 'success' ? 'success' : '';
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

// Theme management
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('fm_theme', state.theme);
  document.documentElement.setAttribute('data-theme', state.theme);
  render();
}

// Auth flow initialization
async function init() {
  initTheme();
  const token = API.getToken();
  if (token) {
    try {
      const data = await API.auth.me();
      state.user = data.user;
      const nav = NAV_CONFIG[state.user.role] || [];
      state.page = nav[0] ? nav[0][0] : 'profile';
    } catch (err) {
      console.warn('Session expired or invalid, please login.');
      API.setToken(null);
      state.user = null;
    }
  }
  render();
}

// Global render
async function render() {
  const root = $('#root');
  if (!state.user) {
    root.innerHTML = renderAuthScreen();
    return;
  }

  const nav = NAV_CONFIG[state.user.role] || [];
  if (!nav.some(item => item[0] === state.page)) {
    state.page = nav[0][0];
  }

  root.innerHTML = `
    <div class="app">
      <aside class="side">
        <div class="logo">
          <i>⛽</i>
          <div>
            <b>FUEL<span>//</span>MANAGER</b>
            <div class="logo-tag">Sprint 1 &amp; 2</div>
          </div>
        </div>

        ${state.user.station ? `
          <div class="station-pill">
            <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Station rattachée</span>
            <b>${esc(state.user.station.nom)}</b>
            <span>${esc(state.user.station.ville || '')}</span>
          </div>
        ` : ''}

        <nav>
          ${nav.map(n => `
            <button class="${n[0] === state.page ? 'on' : ''}" onclick="setPage('${n[0]}')">
              <i>${ICONS[n[0]] || '📌'}</i>
              <span>${esc(n[1])}</span>
            </button>
          `).join('')}
        </nav>

        <div class="me">
          <div class="av">${esc((state.user.prenom || state.user.nom).charAt(0)).toUpperCase()}</div>
          <div>
            <b>${esc(state.user.prenom ? `${state.user.prenom} ${state.user.nom}` : state.user.nom)}</b>
            <small>${ROLES[state.user.role] || state.user.role}</small>
          </div>
          <button class="theme-btn" onclick="toggleTheme()" title="Changer le thème">
            ${state.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onclick="logout()" title="Déconnexion">⏻</button>
        </div>
      </aside>

      <main id="main-content">
        <div style="text-align:center; padding: 60px 20px;">
          <div class="badge neutral">Chargement des données en cours...</div>
        </div>
      </main>
    </div>
  `;

  loadPageView(state.page);
}

function setPage(pageName) {
  state.page = pageName;
  render();
}

// Router for Page views
async function loadPageView(page) {
  const main = $('#main-content');
  try {
    switch (page) {
      case 'dashboard':
        main.innerHTML = await renderDashboard();
        break;
      case 'stations':
        main.innerHTML = await renderStations();
        break;
      case 'fuels':
        main.innerHTML = await renderFuels();
        break;
      case 'pumps':
        main.innerHTML = await renderPumps();
        break;
      case 'tanks':
        main.innerHTML = await renderTanks();
        break;
      case 'stock':
        main.innerHTML = await renderStock();
        break;
      case 'suppliers':
        main.innerHTML = await renderSuppliers();
        break;
      case 'deliveries':
        main.innerHTML = await renderDeliveries();
        break;
      case 'sales':
        main.innerHTML = await renderSales();
        break;
      case 'pos':
        main.innerHTML = await renderPOS();
        initPOSListeners();
        break;
      case 'users':
        main.innerHTML = await renderUsers();
        break;
      case 'profile':
        main.innerHTML = renderProfile();
        break;
      default:
        main.innerHTML = `<div class="card">Page introuvable</div>`;
    }
  } catch (err) {
    main.innerHTML = `
      <div class="card">
        <h3 style="color:var(--dg)">Erreur de chargement</h3>
        <p>${esc(err.message)}</p>
        <button class="p" onclick="render()">Réessayer</button>
      </div>
    `;
  }
}

/* ==========================================================================
   VIEW 1: AUTHENTICATION (US 1, 2, 3)
   ========================================================================== */
let authTab = 'login';

function renderAuthScreen() {
  const isReg = authTab === 'register';
  return `
    <div class="authw">
      <div class="hero">
        <div class="logo">
          <i>⛽</i>
          <b>FUEL<span>//</span>MANAGER</b>
        </div>
        <h1>Pilotez chaque station, chaque litre.</h1>
        <p>Plateforme web moderne de gestion de stations-service : carburants, pompes, cuves, approvisionnements et encaissement en temps réel.</p>
        
        <div class="hero-project-box">
          <b>🎓 Projet d'Intégration — ISET Charguia</b><br>
          <span>Étudiants : Noussair Huimli, Rayen Bakey, Koussay Ghriss</span><br>
          <span>Sous la direction de : <b>Mme Sonia Gannar</b></span><br>
          <span style="font-size:11px; opacity:0.8;">Année Universitaire 2026 – 2027</span>
        </div>
      </div>

      <div class="form-container">
        <div class="card" style="margin-bottom:0">
          <div class="tabs">
            <button class="${!isReg ? 'p' : ''}" onclick="authTab='login';render()">Connexion</button>
            <button class="${isReg ? 'p' : ''}" onclick="authTab='register';render()">Inscription</button>
          </div>

          <form onsubmit="handleAuthSubmit(event)">
            ${isReg ? `
              <div class="form-grid">
                <div>
                  <label>Nom</label>
                  <input id="auth_nom" required placeholder="Ex: Ben Ali">
                </div>
                <div>
                  <label>Prénom</label>
                  <input id="auth_prenom" placeholder="Ex: Karim">
                </div>
              </div>
            ` : ''}

            <label>Adresse E-mail</label>
            <input id="auth_email" type="email" required placeholder="nom@fuelmanager.tn">

            <label>Mot de passe</label>
            <input id="auth_password" type="password" required placeholder="••••••••">

            <div class="err" id="auth_err"></div>

            <button type="submit" class="p" style="width: 100%; padding: 13px; margin-top: 14px;">
              ${isReg ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>

          <div class="quick-demo-logins">
            <small style="text-transform: uppercase; font-size: 11px; color: var(--mu); font-weight: 700; letter-spacing: 0.8px;">
              ⚡ Comptes de test rapides (Soutenance) :
            </small>
            <div class="demo-pills">
              <button class="demo-pill" type="button" onclick="fillDemo('admin@fuelmanager.tn','admin123')">
                👑 Admin
              </button>
              <button class="demo-pill" type="button" onclick="fillDemo('gerant.charguia@fuelmanager.tn','gerant123')">
                🏬 Gérant Charguia
              </button>
              <button class="demo-pill" type="button" onclick="fillDemo('employe.charguia@fuelmanager.tn','employe123')">
                ⛽ Employé Piste
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function fillDemo(email, pass) {
  $('#auth_email').value = email;
  $('#auth_password').value = pass;
  const err = $('#auth_err');
  if (err) err.textContent = '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errBox = $('#auth_err');
  errBox.textContent = '';

  const email = $('#auth_email').value.trim();
  const password = $('#auth_password').value;

  try {
    if (authTab === 'login') {
      const res = await API.auth.login(email, password);
      API.setToken(res.token);
      state.user = res.user;
      toast(`Bienvenue ${res.user.prenom || res.user.nom} !`, 'success');
      render();
    } else {
      const nom = $('#auth_nom').value.trim();
      const prenom = ($('#auth_prenom').value || '').trim();
      const res = await API.auth.register({ nom, prenom, email, motDePasse: password });
      API.setToken(res.token);
      state.user = res.user;
      toast('Votre compte a été créé avec succès.', 'success');
      render();
    }
  } catch (err) {
    errBox.textContent = err.message;
  }
}

function logout() {
  API.setToken(null);
  state.user = null;
  state.page = 'dashboard';
  toast('Déconnexion effectuée.');
  render();
}

/* ==========================================================================
   VIEW 2: DASHBOARD (SYNTHÈSE GLOBALE & STATION)
   ========================================================================== */
async function renderDashboard() {
  const stationId = state.user.stationId;
  const [dash, stock] = await Promise.all([
    API.stats.dashboard(stationId),
    API.stats.stockSummary(stationId)
  ]);

  return `
    <div class="top-bar">
      <div>
        <h2>Tableau de bord</h2>
        <div class="subtitle">Vue d'ensemble de l'activité, des ventes et des stocks de carburant.</div>
      </div>
      <div>
        ${state.user.role === 'admin' ? `
          <button onclick="resetDemoData()" title="Réinitialiser les données de test">🔄 Réinitialiser Démo</button>
        ` : ''}
      </div>
    </div>

    <div class="stats">
      <div class="st">
        <small>Volume en cuves</small>
        <b>${dash.totalStockVolume.toLocaleString()} L</b>
        <div class="st-sub">${dash.globalStockPercentage}% de capacité globale</div>
      </div>
      <div class="st highlight">
        <small>Ventes du jour</small>
        <b>${dash.todaysSalesRevenue.toFixed(3)} <span style="font-size:18px">DT</span></b>
        <div class="st-sub">${dash.todaysLitersSold} L servis aujourd'hui</div>
      </div>
      <div class="st">
        <small>Pompes actives</small>
        <b>${dash.pumpsActive} / ${dash.pumpsCount}</b>
        <div class="st-sub">Équipements de distribution</div>
      </div>
      <div class="st">
        <small>Alertes Stock</small>
        <b style="color:${dash.alertsCount > 0 ? 'var(--dg)' : 'inherit'}">${dash.alertsCount}</b>
        <div class="st-sub">${dash.alertsCount > 0 ? '⚠️ Seuil minimal atteint !' : 'Tous niveaux normaux'}</div>
      </div>
    </div>

    <!-- US 29 & 30: Jauges de Stock en temps réel -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🛢️ Niveaux de Stock par Carburant (Sprint 2 — US 29 &amp; 30)</h3>
        <button class="sm" onclick="setPage('${state.user.role === 'admin' ? 'fuels' : 'stock'}')">Gérer les seuils</button>
      </div>

      <div class="tank-grid">
        ${stock.map(s => {
          const isDanger = s.estFaible;
          const statusClass = s.estCritique ? 'danger' : s.estFaible ? 'warn' : 'suc';
          const fillPercent = Math.min(100, Math.max(0, s.pourcentage));
          return `
            <div class="tank-card ${isDanger ? 'alert-border' : ''}">
              <div class="tank-header">
                <div class="tank-title">
                  <span class="tank-dot" style="background:${s.couleur || 'var(--ac)'}"></span>
                  ${esc(s.libelle)}
                </div>
                <span class="badge ${statusClass}">
                  ${s.estCritique ? 'Critique' : s.estFaible ? 'Stock Faible' : 'Normal'}
                </span>
              </div>

              <div class="progress-track">
                <div class="progress-fill" style="width: ${fillPercent}%; background: ${isDanger ? 'var(--dg)' : (s.couleur || 'var(--ac)')}"></div>
              </div>

              <div class="tank-meta">
                <span>Disponible : <b>${s.totalNiveau.toLocaleString()} L</b></span>
                <span>Capacité : <b>${s.totalCapacite.toLocaleString()} L</b></span>
              </div>

              <div style="font-size:12px; color:var(--mu); display:flex; justify-content:space-between; align-items:center;">
                <span>Prix : <b>${s.prixUnitaire.toFixed(3)} DT/L</b></span>
                <span>Seuil alerte : <b>${s.seuilMinimal} L</b></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Actions directes selon le rôle -->
    ${state.user.role === 'employe' ? `
      <div class="card" style="text-align:center; padding: 36px 20px;">
        <h3>Point de Vente — Servir un client</h3>
        <p class="mu">Enregistrez un plein et calculez automatiquement le montant en un clic.</p>
        <button class="p" style="padding: 12px 28px; font-size: 16px;" onclick="setPage('pos')">
          ⛽ Ouvrir la Caisse Vente
        </button>
      </div>
    ` : ''}
  `;
}

async function resetDemoData() {
  if (!confirm('Réinitialiser la base de données aux valeurs d’origine (stations, carburants, comptes) ?')) return;
  try {
    await API.auth.resetDemo();
    toast('Données réinitialisées avec succès !', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 3: STATIONS (US 6, 7, 8, 9)
   ========================================================================== */
async function renderStations() {
  const stations = await API.stations.list();
  state.cache.stations = stations;

  return `
    <div class="top-bar">
      <div>
        <h2>Stations-service du réseau</h2>
        <div class="subtitle">Gestion du réseau de distribution (Sprint 1 — US 6 à 9).</div>
      </div>
      <button class="p" onclick="openStationModal()">+ Ajouter une station</button>
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>Nom de la station</th>
            <th>Ville</th>
            <th>Adresse</th>
            <th>Téléphone</th>
            <th>État</th>
            <th>Équipements</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${stations.map(s => `
            <tr>
              <td><b>${esc(s.nom)}</b></td>
              <td>${esc(s.ville)}</td>
              <td>${esc(s.adresse)}</td>
              <td>${esc(s.telephone || '—')}</td>
              <td>
                <span class="badge ${s.etat === 'Active' ? 'suc' : 'neutral'}">
                  ${esc(s.etat)}
                </span>
              </td>
              <td>
                <small class="mu">${s.nbPompes || 0} pompes • ${s.nbCuves || 0} cuves</small>
              </td>
              <td class="a">
                <button onclick="openStationModal(${s.id})">Modifier</button>
                <button class="d" onclick="deleteStation(${s.id})">Supprimer</button>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="7" class="mu" style="text-align:center">Aucune station enregistrée.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openStationModal(id = null) {
  const isEdit = Boolean(id);
  const s = isEdit ? state.cache.stations.find(item => item.id === id) : {};

  $('#dlg').innerHTML = `
    <form onsubmit="handleStationSubmit(event, ${id || 'null'})">
      <h3 style="margin-top:0">${isEdit ? 'Modifier la station' : 'Ajouter une nouvelle station'}</h3>

      <label>Nom de la station *</label>
      <input id="st_nom" required value="${esc(s.nom || '')}" placeholder="Ex: Station Agil Charguia">

      <div class="form-grid">
        <div>
          <label>Ville *</label>
          <input id="st_ville" required value="${esc(s.ville || '')}" placeholder="Ex: Tunis">
        </div>
        <div>
          <label>Téléphone</label>
          <input id="st_tel" value="${esc(s.telephone || '')}" placeholder="Ex: +216 71 800 100">
        </div>
      </div>

      <label>Adresse complète *</label>
      <input id="st_adresse" required value="${esc(s.adresse || '')}" placeholder="Ex: Rue de l'Aéroport, Charguia II">

      <label>État de fonctionnement</label>
      <select id="st_etat">
        <option value="Active" ${s.etat !== 'Inactive' ? 'selected' : ''}>Active</option>
        <option value="Inactive" ${s.etat === 'Inactive' ? 'selected' : ''}>Inactive</option>
      </select>

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Enregistrer</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleStationSubmit(e, id) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const data = {
    nom: $('#st_nom').value.trim(),
    ville: $('#st_ville').value.trim(),
    adresse: $('#st_adresse').value.trim(),
    telephone: $('#st_tel').value.trim(),
    etat: $('#st_etat').value
  };

  try {
    if (id) {
      await API.stations.update(id, data);
      toast('Station mise à jour !', 'success');
    } else {
      await API.stations.create(data);
      toast('Station créée avec succès !', 'success');
    }
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

async function deleteStation(id) {
  if (!confirm('Supprimer définitivement cette station et ses équipements ?')) return;
  try {
    await API.stations.delete(id);
    toast('Station supprimée.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 4: FUELS & PRICING (US 10, 11, 12, 13, 30)
   ========================================================================== */
async function renderFuels() {
  const fuels = await API.fuels.list();
  state.cache.fuels = fuels;

  return `
    <div class="top-bar">
      <div>
        <h2>Types de Carburant &amp; Tarifs</h2>
        <div class="subtitle">Catalogue des produits vendus, prix unitaires et seuils minimaux (Sprint 1 &amp; 2).</div>
      </div>
      ${state.user.role === 'admin' ? `
        <button class="p" onclick="openFuelModal()">+ Ajouter un carburant</button>
      ` : ''}
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>Carburant</th>
            <th>Prix unitaire (DT/L)</th>
            <th>Seuil d'alerte stock (L)</th>
            <th>Couleur</th>
            <th>Description</th>
            ${state.user.role === 'admin' ? '<th style="text-align:right">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${fuels.map(f => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="tank-dot" style="background:${f.couleur || 'var(--ac)'}"></span>
                  <b>${esc(f.libelle)}</b>
                </div>
              </td>
              <td><b style="font-size:16px;">${Number(f.prixUnitaire).toFixed(3)} DT</b></td>
              <td><span class="badge neutral">${(f.seuilMinimal || 3000).toLocaleString()} L</span></td>
              <td><div style="width:22px; height:22px; border-radius:6px; background:${f.couleur}"></div></td>
              <td class="mu">${esc(f.description || '—')}</td>
              ${state.user.role === 'admin' ? `
                <td class="a">
                  <button onclick="openFuelModal(${f.id})">Modifier / Tarif</button>
                  <button class="d" onclick="deleteFuel(${f.id})">Supprimer</button>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openFuelModal(id = null) {
  const isEdit = Boolean(id);
  const f = isEdit ? state.cache.fuels.find(item => item.id === id) : {};

  $('#dlg').innerHTML = `
    <form onsubmit="handleFuelSubmit(event, ${id || 'null'})">
      <h3 style="margin-top:0">${isEdit ? 'Modifier le carburant & le tarif' : 'Nouveau type de carburant'}</h3>

      <label>Nom du carburant *</label>
      <input id="f_libelle" required value="${esc(f.libelle || '')}" placeholder="Ex: Sans Plomb 95">

      <div class="form-grid">
        <div>
          <label>Prix unitaire (DT / Litre) *</label>
          <input id="f_prix" type="number" step="0.001" min="0.001" required value="${f.prixUnitaire || ''}" placeholder="Ex: 2.525">
        </div>
        <div>
          <label>Seuil d'alerte minimal (Litres) *</label>
          <input id="f_seuil" type="number" min="100" required value="${f.seuilMinimal || 3000}" placeholder="Ex: 3000">
        </div>
      </div>

      <div class="form-grid">
        <div>
          <label>Couleur du repère</label>
          <input id="f_couleur" type="color" value="${f.couleur || '#ff4d2e'}">
        </div>
        <div>
          <label>Description courte</label>
          <input id="f_desc" value="${esc(f.description || '')}" placeholder="Ex: Essence super sans plomb">
        </div>
      </div>

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Enregistrer</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleFuelSubmit(e, id) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const data = {
    libelle: $('#f_libelle').value.trim(),
    prixUnitaire: parseFloat($('#f_prix').value),
    seuilMinimal: parseInt($('#f_seuil').value, 10),
    couleur: $('#f_couleur').value,
    description: $('#f_desc').value.trim()
  };

  try {
    if (id) {
      await API.fuels.update(id, data);
      toast('Carburant et tarif mis à jour !', 'success');
    } else {
      await API.fuels.create(data);
      toast('Type de carburant ajouté !', 'success');
    }
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

async function deleteFuel(id) {
  if (!confirm('Supprimer ce carburant du catalogue ?')) return;
  try {
    await API.fuels.delete(id);
    toast('Carburant supprimé.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 5: PUMPS / POMPES (US 14, 15, 16)
   ========================================================================== */
async function renderPumps() {
  const stationId = state.user.stationId;
  const [pumps, fuels, stations] = await Promise.all([
    API.pumps.list(stationId),
    API.fuels.list(),
    API.stations.list()
  ]);

  state.cache.pumps = pumps;
  state.cache.fuels = fuels;
  state.cache.stations = stations;

  const canManage = state.user.role === 'admin' || state.user.role === 'gerant';

  return `
    <div class="top-bar">
      <div>
        <h2>Pompes de distribution</h2>
        <div class="subtitle">Gestion des bornes de pompage (Sprint 1 — US 14 à 16).</div>
      </div>
      ${canManage ? `
        <button class="p" onclick="openPumpModal()">+ Ajouter une pompe</button>
      ` : ''}
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>N° Pompe</th>
            <th>Station</th>
            <th>Carburant distribué</th>
            <th>Tarif actuel</th>
            <th>État</th>
            <th>Emplacement / Description</th>
            ${canManage ? '<th style="text-align:right">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${pumps.map(p => `
            <tr>
              <td><b style="font-size:16px;">Pompe #${p.numero}</b></td>
              <td>${esc(p.station ? p.station.nom : '—')}</td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="tank-dot" style="background:${p.carburant ? p.carburant.couleur : 'var(--ac)'}"></span>
                  ${esc(p.carburant ? p.carburant.libelle : '—')}
                </div>
              </td>
              <td>${p.carburant ? `${p.carburant.prixUnitaire.toFixed(3)} DT` : '—'}</td>
              <td>
                <span class="badge ${p.etat === 'En service' ? 'suc' : p.etat === 'Maintenance' ? 'warn' : 'danger'}">
                  ${esc(p.etat)}
                </span>
              </td>
              <td class="mu">${esc(p.description || '—')}</td>
              ${canManage ? `
                <td class="a">
                  <button onclick="openPumpModal(${p.id})">Modifier</button>
                  <button class="d" onclick="deletePump(${p.id})">Supprimer</button>
                </td>
              ` : ''}
            </tr>
          `).join('') || `<tr><td colspan="7" class="mu" style="text-align:center">Aucune pompe enregistrée.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openPumpModal(id = null) {
  const isEdit = Boolean(id);
  const p = isEdit ? state.cache.pumps.find(item => item.id === id) : {};
  const fuels = state.cache.fuels;
  const stations = state.cache.stations;

  $('#dlg').innerHTML = `
    <form onsubmit="handlePumpSubmit(event, ${id || 'null'})">
      <h3 style="margin-top:0">${isEdit ? 'Modifier la pompe' : 'Ajouter une pompe'}</h3>

      ${state.user.role === 'admin' ? `
        <label>Station rattachée *</label>
        <select id="p_station" required>
          ${stations.map(s => `<option value="${s.id}" ${p.stationId === s.id ? 'selected' : ''}>${esc(s.nom)} (${esc(s.ville)})</option>`).join('')}
        </select>
      ` : ''}

      <div class="form-grid">
        <div>
          <label>Numéro de pompe *</label>
          <input id="p_num" type="number" min="1" required value="${p.numero || ''}" placeholder="Ex: 1">
        </div>
        <div>
          <label>Carburant rattaché *</label>
          <select id="p_fuel" required>
            ${fuels.map(f => `<option value="${f.id}" ${p.carburantId === f.id ? 'selected' : ''}>${esc(f.libelle)}</option>`).join('')}
          </select>
        </div>
      </div>

      <label>État de service *</label>
      <select id="p_etat">
        <option value="En service" ${p.etat === 'En service' ? 'selected' : ''}>En service</option>
        <option value="Hors service" ${p.etat === 'Hors service' ? 'selected' : ''}>Hors service</option>
        <option value="Maintenance" ${p.etat === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
      </select>

      <label>Emplacement / Description</label>
      <input id="p_desc" value="${esc(p.description || '')}" placeholder="Ex: Îlot A - Piste principale">

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Enregistrer</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handlePumpSubmit(e, id) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const data = {
    numero: parseInt($('#p_num').value, 10),
    carburantId: parseInt($('#p_fuel').value, 10),
    etat: $('#p_etat').value,
    description: $('#p_desc').value.trim()
  };

  if (state.user.role === 'admin') {
    data.stationId = parseInt($('#p_station').value, 10);
  }

  try {
    if (id) {
      await API.pumps.update(id, data);
      toast('Pompe mise à jour !', 'success');
    } else {
      await API.pumps.create(data);
      toast('Pompe ajoutée avec succès !', 'success');
    }
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

async function deletePump(id) {
  if (!confirm('Supprimer cette pompe ?')) return;
  try {
    await API.pumps.delete(id);
    toast('Pompe supprimée.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 6: TANKS & STOCKS (US 17, 18, 19 & US 29, 30)
   ========================================================================== */
async function renderTanks() {
  return renderStockView(true);
}

async function renderStock() {
  return renderStockView(false);
}

async function renderStockView(managementMode = false) {
  const stationId = state.user.stationId;
  const [tanks, fuels, stations, movements] = await Promise.all([
    API.tanks.list(stationId),
    API.fuels.list(),
    API.stations.list(),
    API.stats.movements(stationId)
  ]);

  state.cache.tanks = tanks;
  state.cache.fuels = fuels;
  state.cache.stations = stations;

  const canManage = state.user.role === 'admin' || state.user.role === 'gerant';

  return `
    <div class="top-bar">
      <div>
        <h2>${managementMode ? 'Cuves de stockage' : 'Suivi des stocks de carburant'}</h2>
        <div class="subtitle">Capacités, niveaux en temps réel et alertes de seuil (Sprint 1 &amp; 2).</div>
      </div>
      ${canManage ? `
        <button class="p" onclick="openTankModal()">+ Ajouter une cuve</button>
      ` : ''}
    </div>

    <div class="tank-grid" style="margin-bottom: 24px;">
      ${tanks.map(t => {
        const isLow = t.estFaible;
        const statusClass = t.estCritique ? 'danger' : t.estFaible ? 'warn' : 'suc';
        return `
          <div class="tank-card ${isLow ? 'alert-border' : ''}">
            <div class="tank-header">
              <div>
                <div class="tank-title">
                  <span class="tank-dot" style="background:${t.carburant ? t.carburant.couleur : 'var(--ac)'}"></span>
                  Cuve #${t.id} — ${esc(t.carburant ? t.carburant.libelle : 'Carburant')}
                </div>
                <small class="mu">${esc(t.station ? t.station.nom : '')}</small>
              </div>
              <span class="badge ${statusClass}">
                ${t.estCritique ? '🚨 Critique' : t.estFaible ? '⚠️ Faible' : '✅ Normal'}
              </span>
            </div>

            <div class="progress-track">
              <div class="progress-fill" style="width: ${t.pourcentage}%; background: ${isLow ? 'var(--dg)' : (t.carburant?.couleur || 'var(--ac)')}"></div>
            </div>

            <div class="tank-meta">
              <span>Niveau actuel : <b>${t.niveauActuel.toLocaleString()} L</b></span>
              <span>Remplissage : <b>${t.pourcentage}%</b></span>
            </div>

            <div class="tank-meta">
              <span>Capacité totale : <b>${t.capacite.toLocaleString()} L</b></span>
              <span>Seuil alerte : <b>${t.seuilMinimal.toLocaleString()} L</b></span>
            </div>

            ${canManage ? `
              <div class="row" style="margin-top:8px; border-top:1px dashed var(--bd); padding-top:12px; display:flex; justify-content:flex-end; gap:6px;">
                <button class="sm" onclick="openTankModal(${t.id})">Ajuster / Modifier</button>
                <button class="sm d" onclick="deleteTank(${t.id})">Supprimer</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('') || `<div class="card mu" style="grid-column: 1/-1">Aucune cuve configurée.</div>`}
    </div>

    <!-- Mouvements de stock récents (Entrées vs Sorties) -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📜 Historique des Mouvements de Stock (Sprint 2)</h3>
      </div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Date &amp; Heure</th>
              <th>Station</th>
              <th>Carburant</th>
              <th>Type de mouvement</th>
              <th>Quantité</th>
              <th>Ancien niveau</th>
              <th>Nouveau niveau</th>
              <th>Réf. Document</th>
              <th>Opérateur</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => `
              <tr>
                <td>${new Date(m.dateHeure).toLocaleString('fr-FR')}</td>
                <td>${esc(m.station)}</td>
                <td><b>${esc(m.carburant)}</b></td>
                <td>
                  <span class="badge ${m.type === 'ENTREE_LIVRAISON' ? 'suc' : 'neutral'}">
                    ${m.type === 'ENTREE_LIVRAISON' ? '📥 Entrée (Livraison)' : '📤 Sortie (Vente)'}
                  </span>
                </td>
                <td><b>${m.quantite.toLocaleString()} L</b></td>
                <td class="mu">${m.ancienNiveau.toLocaleString()} L</td>
                <td><b>${m.nouveauNiveau.toLocaleString()} L</b></td>
                <td><code>${esc(m.referenceId)}</code></td>
                <td>${esc(m.auteur || '—')}</td>
              </tr>
            `).join('') || `<tr><td colspan="9" class="mu" style="text-align:center">Aucun mouvement récent.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openTankModal(id = null) {
  const isEdit = Boolean(id);
  const t = isEdit ? state.cache.tanks.find(item => item.id === id) : {};
  const fuels = state.cache.fuels;
  const stations = state.cache.stations;

  $('#dlg').innerHTML = `
    <form onsubmit="handleTankSubmit(event, ${id || 'null'})">
      <h3 style="margin-top:0">${isEdit ? 'Modifier la cuve' : 'Ajouter une cuve'}</h3>

      ${state.user.role === 'admin' ? `
        <label>Station *</label>
        <select id="tk_station" required>
          ${stations.map(s => `<option value="${s.id}" ${t.stationId === s.id ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}
        </select>
      ` : ''}

      <label>Carburant stocké *</label>
      <select id="tk_fuel" required>
        ${fuels.map(f => `<option value="${f.id}" ${t.carburantId === f.id ? 'selected' : ''}>${esc(f.libelle)}</option>`).join('')}
      </select>

      <div class="form-grid">
        <div>
          <label>Capacité maximale (Litres) *</label>
          <input id="tk_cap" type="number" min="1000" step="100" required value="${t.capacite || ''}" placeholder="Ex: 20000">
        </div>
        <div>
          <label>Niveau actuel (Litres) *</label>
          <input id="tk_niv" type="number" min="0" step="1" required value="${t.niveauActuel !== undefined ? t.niveauActuel : ''}" placeholder="Ex: 14000">
        </div>
      </div>

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Enregistrer</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleTankSubmit(e, id) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const cap = parseFloat($('#tk_cap').value);
  const niv = parseFloat($('#tk_niv').value);

  if (niv > cap) {
    errBox.textContent = 'Le niveau actuel ne peut excéder la capacité totale.';
    return;
  }

  const data = {
    carburantId: parseInt($('#tk_fuel').value, 10),
    capacite: cap,
    niveauActuel: niv
  };

  if (state.user.role === 'admin') {
    data.stationId = parseInt($('#tk_station').value, 10);
  }

  try {
    if (id) {
      await API.tanks.update(id, data);
      toast('Cuve mise à jour !', 'success');
    } else {
      await API.tanks.create(data);
      toast('Cuve enregistrée avec succès !', 'success');
    }
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

async function deleteTank(id) {
  if (!confirm('Supprimer définitivement cette cuve ?')) return;
  try {
    await API.tanks.delete(id);
    toast('Cuve supprimée.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 7: SUPPLIERS / FOURNISSEURS (US 20, 21, 22, 23)
   ========================================================================== */
async function renderSuppliers() {
  const suppliers = await API.suppliers.list();
  state.cache.suppliers = suppliers;

  return `
    <div class="top-bar">
      <div>
        <h2>Fournisseurs de carburant</h2>
        <div class="subtitle">Gestion des compagnies pétrolières partenaires (Sprint 2 — US 20 à 23).</div>
      </div>
      <button class="p" onclick="openSupplierModal()">+ Ajouter un fournisseur</button>
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>Fournisseur</th>
            <th>Téléphone</th>
            <th>E-mail</th>
            <th>Adresse</th>
            <th>Matricule Fiscale</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${suppliers.map(s => `
            <tr>
              <td><b>${esc(s.nom)}</b></td>
              <td>${esc(s.telephone || '—')}</td>
              <td>${esc(s.email || '—')}</td>
              <td>${esc(s.adresse || '—')}</td>
              <td><code>${esc(s.matriculeFiscale || '—')}</code></td>
              <td class="a">
                <button onclick="openSupplierModal(${s.id})">Modifier</button>
                <button class="d" onclick="deleteSupplier(${s.id})">Supprimer</button>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="6" class="mu" style="text-align:center">Aucun fournisseur enregistré.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openSupplierModal(id = null) {
  const isEdit = Boolean(id);
  const s = isEdit ? state.cache.suppliers.find(item => item.id === id) : {};

  $('#dlg').innerHTML = `
    <form onsubmit="handleSupplierSubmit(event, ${id || 'null'})">
      <h3 style="margin-top:0">${isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>

      <label>Raison Sociale / Nom *</label>
      <input id="sup_nom" required value="${esc(s.nom || '')}" placeholder="Ex: SNDP AGIL Tunisie">

      <div class="form-grid">
        <div>
          <label>Téléphone</label>
          <input id="sup_tel" value="${esc(s.telephone || '')}" placeholder="Ex: +216 71 000 000">
        </div>
        <div>
          <label>E-mail</label>
          <input id="sup_email" type="email" value="${esc(s.email || '')}" placeholder="Ex: contact@agil.com.tn">
        </div>
      </div>

      <div class="form-grid">
        <div>
          <label>Matricule Fiscale</label>
          <input id="sup_mf" value="${esc(s.matriculeFiscale || '')}" placeholder="Ex: 0001234A/M/000">
        </div>
        <div>
          <label>Adresse du siège</label>
          <input id="sup_addr" value="${esc(s.adresse || '')}" placeholder="Ex: Radès, Tunis">
        </div>
      </div>

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Enregistrer</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleSupplierSubmit(e, id) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const data = {
    nom: $('#sup_nom').value.trim(),
    telephone: $('#sup_tel').value.trim(),
    email: $('#sup_email').value.trim(),
    matriculeFiscale: $('#sup_mf').value.trim(),
    adresse: $('#sup_addr').value.trim()
  };

  try {
    if (id) {
      await API.suppliers.update(id, data);
      toast('Fournisseur mis à jour !', 'success');
    } else {
      await API.suppliers.create(data);
      toast('Fournisseur ajouté avec succès !', 'success');
    }
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

async function deleteSupplier(id) {
  if (!confirm('Supprimer ce fournisseur ?')) return;
  try {
    await API.suppliers.delete(id);
    toast('Fournisseur supprimé.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==========================================================================
   VIEW 8: DELIVERIES / LIVRAISONS (US 24, 25)
   ========================================================================== */
async function renderDeliveries() {
  const stationId = state.user.stationId;
  const [deliveries, suppliers, fuels, tanks, stations] = await Promise.all([
    API.deliveries.list(stationId),
    API.suppliers.list(),
    API.fuels.list(),
    API.tanks.list(stationId),
    API.stations.list()
  ]);

  state.cache.suppliers = suppliers;
  state.cache.fuels = fuels;
  state.cache.tanks = tanks;
  state.cache.stations = stations;

  const canAdd = state.user.role === 'admin' || state.user.role === 'gerant';

  return `
    <div class="top-bar">
      <div>
        <h2>Livraisons &amp; Approvisionnements</h2>
        <div class="subtitle">Enregistrement des réceptions de carburant et incrémentation automatique du stock (Sprint 2 — US 24 &amp; 25).</div>
      </div>
      ${canAdd ? `
        <button class="p" onclick="openDeliveryModal()">+ Enregistrer une livraison</button>
      ` : ''}
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>N° Bon de Livraison</th>
            <th>Date &amp; Heure</th>
            <th>Fournisseur</th>
            <th>Station</th>
            <th>Carburant &amp; Cuve</th>
            <th>Quantité reçue</th>
            <th>Prix Achat (DT/L)</th>
            <th>Total Achat</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${deliveries.map(d => {
            const totalAchat = (d.quantite * (d.prixAchat || 0)).toFixed(3);
            return `
              <tr>
                <td><code><b>${esc(d.numeroBon)}</b></code></td>
                <td>${new Date(d.date).toLocaleString('fr-FR')}</td>
                <td><b>${esc(d.fournisseur)}</b></td>
                <td>${esc(d.station)}</td>
                <td>
                  <span class="badge neutral">${esc(d.cuve)}</span>
                </td>
                <td><b style="color:var(--suc); font-size:15px;">+${d.quantite.toLocaleString()} L</b></td>
                <td>${(d.prixAchat || 0).toFixed(3)} DT</td>
                <td><b>${totalAchat} DT</b></td>
                <td class="mu">${esc(d.notes || '—')}</td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="9" class="mu" style="text-align:center">Aucune livraison enregistrée.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openDeliveryModal() {
  const suppliers = state.cache.suppliers;
  const tanks = state.cache.tanks;
  const stations = state.cache.stations;

  if (!suppliers.length) {
    toast('Veuillez d’abord enregistrer au moins un fournisseur.', 'error');
    return;
  }
  if (!tanks.length) {
    toast('Aucune cuve disponible pour recevoir du carburant.', 'error');
    return;
  }

  $('#dlg').innerHTML = `
    <form onsubmit="handleDeliverySubmit(event)">
      <h3 style="margin-top:0">Enregistrer une livraison de carburant</h3>
      <p class="mu" style="font-size:13px; margin-top:-6px;">Le niveau de la cuve sera immédiatement augmenté du volume livré.</p>

      <div class="form-grid">
        <div>
          <label>N° Bon de livraison *</label>
          <input id="del_bon" required placeholder="Ex: BL-2026-045">
        </div>
        <div>
          <label>Date de réception *</label>
          <input id="del_date" type="datetime-local" required value="${new Date().toISOString().slice(0, 16)}">
        </div>
      </div>

      <label>Fournisseur partenaire *</label>
      <select id="del_sup" required>
        ${suppliers.map(s => `<option value="${s.id}">${esc(s.nom)}</option>`).join('')}
      </select>

      ${state.user.role === 'admin' ? `
        <label>Station destinataire *</label>
        <select id="del_station" onchange="filterDeliveryTanks(this.value)">
          ${stations.map(s => `<option value="${s.id}">${esc(s.nom)}</option>`).join('')}
        </select>
      ` : ''}

      <label>Cuve &amp; Carburant de dépotage *</label>
      <select id="del_tank" required>
        ${tanks.map(t => `
          <option value="${t.id}" data-fuel="${t.carburantId}" data-left="${t.capacite - t.niveauActuel}">
            Cuve #${t.id} — ${esc(t.carburant?.libelle || '')} (Espace restant: ${(t.capacite - t.niveauActuel).toLocaleString()} L)
          </option>
        `).join('')}
      </select>

      <div class="form-grid">
        <div>
          <label>Quantité livrée (Litres) *</label>
          <input id="del_qte" type="number" min="1" step="1" required placeholder="Ex: 5000">
        </div>
        <div>
          <label>Prix d'achat HT (DT / L)</label>
          <input id="del_prix" type="number" step="0.001" min="0" placeholder="Ex: 2.150">
        </div>
      </div>

      <label>Remarques / Chauffeur / Citerne</label>
      <input id="del_notes" placeholder="Ex: Citerne A12, chauffeur Salah">

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Valider le dépotage</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleDeliverySubmit(e) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const tankSelect = $('#del_tank');
  const selectedOption = tankSelect.selectedOptions[0];
  const cuveId = parseInt(tankSelect.value, 10);
  const carburantId = parseInt(selectedOption.getAttribute('data-fuel'), 10);

  const data = {
    numeroBon: $('#del_bon').value.trim(),
    date: $('#del_date').value,
    fournisseurId: parseInt($('#del_sup').value, 10),
    cuveId,
    carburantId,
    quantite: parseFloat($('#del_qte').value),
    prixAchat: parseFloat($('#del_prix').value || 0),
    notes: $('#del_notes').value.trim()
  };

  if (state.user.role === 'admin') {
    data.stationId = parseInt($('#del_station').value, 10);
  }

  try {
    const res = await API.deliveries.create(data);
    toast(`Livraison validée ! Nouveau stock : ${res.cuve.nouveauNiveau} L`, 'success');
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

/* ==========================================================================
   VIEW 9: SALES & POS CAISSE (US 26, 27, 28)
   ========================================================================== */
async function renderPOS() {
  const stationId = state.user.stationId;
  if (!stationId && state.user.role !== 'admin') {
    return `<div class="card mu">Aucune station ne vous est assignée. Contactez l'administrateur.</div>`;
  }

  const [pumps, fuels, tanks] = await Promise.all([
    API.pumps.list(stationId),
    API.fuels.list(),
    API.tanks.list(stationId)
  ]);

  state.cache.pumps = pumps;
  state.cache.fuels = fuels;
  state.cache.tanks = tanks;

  // Active pumps only
  const activePumps = pumps.filter(p => p.etat === 'En service');

  return `
    <div class="top-bar">
      <div>
        <h2>Caisse &amp; Distribution Rapide</h2>
        <div class="subtitle">Enregistrement des sorties carburant avec calcul automatique et décrémentation du stock (Sprint 2 — US 26 à 28).</div>
      </div>
      <button onclick="setPage('sales')">📜 Historique des ventes</button>
    </div>

    <div class="pos-layout">
      <!-- Section Sélection Pompe & Quantité -->
      <div>
        <div class="card">
          <h3 style="margin-top:0">1. Choisissez la pompe de distribution</h3>
          <div class="fuel-selector-grid">
            ${activePumps.map((p, idx) => `
              <div class="fuel-card-btn ${idx === 0 ? 'selected' : ''}" data-pump-id="${p.id}" data-fuel-id="${p.carburantId}" onclick="selectPump(${p.id})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <b style="font-size:16px;">Pompe #${p.numero}</b>
                  <span class="tank-dot" style="background:${p.carburant?.couleur || 'var(--ac)'}"></span>
                </div>
                <div style="font-weight:700; color:var(--tx);">${esc(p.carburant?.libelle || '')}</div>
                <div style="font-size:13px; color:var(--mu);">Tarif : <b>${p.carburant?.prixUnitaire.toFixed(3)} DT/L</b></div>
              </div>
            `).join('') || `<div class="mu">Aucune pompe en service dans cette station.</div>`}
          </div>

          <h3>2. Quantité servie</h3>
          <label>Volume en Litres</label>
          <input id="pos_qte" type="number" step="0.5" min="1" value="20" style="font-size:24px; font-weight:700; height:56px;" placeholder="Ex: 20">

          <div class="quick-amounts">
            <button type="button" class="sm" onclick="setVolume(10)">10 Litres</button>
            <button type="button" class="sm" onclick="setVolume(20)">20 Litres</button>
            <button type="button" class="sm" onclick="setVolume(40)">40 Litres</button>
            <button type="button" class="sm" onclick="setVolume(60)">60 Litres</button>
          </div>

          <label>Mode de règlement</label>
          <select id="pos_pay">
            <option value="Espèces">Espèces</option>
            <option value="Carte Bancaire">Carte Bancaire (TPE)</option>
            <option value="Bon Carburant">Bon Carburant Entreprise</option>
          </select>
        </div>
      </div>

      <!-- Ticket & Résumé du Montant -->
      <div>
        <div class="card" style="position:sticky; top:24px;">
          <h3 style="margin-top:0">Ticket de Caisse</h3>
          
          <div class="receipt-preview" id="pos_receipt_preview">
            <div style="text-align:center; border-bottom:1px dashed var(--bd); padding-bottom:10px; margin-bottom:12px;">
              <b>⛽ ${esc(state.user.station?.nom || 'FUEL//MANAGER')}</b><br>
              <small>${new Date().toLocaleDateString('fr-FR')}</small>
            </div>

            <div class="row">
              <span>Pompe :</span>
              <b id="rec_pompe">—</b>
            </div>
            <div class="row">
              <span>Produit :</span>
              <b id="rec_fuel">—</b>
            </div>
            <div class="row">
              <span>Prix au Litre :</span>
              <span id="rec_unit">—</span>
            </div>
            <div class="row">
              <span>Quantité :</span>
              <b id="rec_qte">20.0 L</b>
            </div>

            <div style="border-top:1px dashed var(--bd); margin-top:14px; padding-top:10px;">
              <div class="row" style="font-size:20px; font-weight:700;">
                <span>Total Net :</span>
                <span id="rec_total" style="color:var(--ac);">0.000 DT</span>
              </div>
            </div>
          </div>

          <div class="err" id="pos_err"></div>

          <button id="pos_submit_btn" class="p" style="width:100%; padding:15px; font-size:16px; margin-top:16px;" onclick="submitSale()">
            ✅ Valider &amp; Imprimer Ticket
          </button>
        </div>
      </div>
    </div>
  `;
}

let selectedPumpId = null;

function selectPump(pumpId) {
  selectedPumpId = pumpId;
  $$('.fuel-card-btn').forEach(btn => {
    btn.classList.toggle('selected', Number(btn.getAttribute('data-pump-id')) === pumpId);
  });
  updatePOSCalculation();
}

function setVolume(liters) {
  const input = $('#pos_qte');
  if (input) {
    input.value = liters;
    updatePOSCalculation();
  }
}

function initPOSListeners() {
  const qteInput = $('#pos_qte');
  if (qteInput) {
    qteInput.addEventListener('input', updatePOSCalculation);
  }
  // Auto select first pump
  const firstPump = $('.fuel-card-btn');
  if (firstPump) {
    const pId = Number(firstPump.getAttribute('data-pump-id'));
    selectPump(pId);
  }
}

function updatePOSCalculation() {
  const qteInput = $('#pos_qte');
  const qte = parseFloat(qteInput ? qteInput.value : 0) || 0;

  const pump = state.cache.pumps.find(p => p.id === selectedPumpId);
  if (!pump || !pump.carburant) return;

  const unitPrice = pump.carburant.prixUnitaire;
  const total = (qte * unitPrice).toFixed(3);

  const elPompe = $('#rec_pompe');
  const elFuel = $('#rec_fuel');
  const elUnit = $('#rec_unit');
  const elQte = $('#rec_qte');
  const elTotal = $('#rec_total');

  if (elPompe) elPompe.textContent = `Pompe #${pump.numero}`;
  if (elFuel) elFuel.textContent = pump.carburant.libelle;
  if (elUnit) elUnit.textContent = `${unitPrice.toFixed(3)} DT/L`;
  if (elQte) elQte.textContent = `${qte.toFixed(1)} L`;
  if (elTotal) elTotal.textContent = `${total} DT`;
}

async function submitSale() {
  const errBox = $('#pos_err');
  errBox.textContent = '';

  const qteInput = $('#pos_qte');
  const qte = parseFloat(qteInput.value);

  if (isNaN(qte) || qte <= 0) {
    errBox.textContent = 'Veuillez saisir une quantité valide.';
    return;
  }

  const payMode = $('#pos_pay').value;

  const data = {
    pompeId: selectedPumpId,
    quantite: qte,
    modePaiement: payMode
  };

  try {
    const res = await API.sales.create(data);
    toast(`Vente enregistrée avec succès (${res.sale.montant.toFixed(3)} DT) !`, 'success');

    // Show printable receipt dialog
    openReceiptModal(res.sale);
  } catch (err) {
    errBox.textContent = err.message;
  }
}

function openReceiptModal(sale) {
  $('#dlg').innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:32px; margin-bottom:8px;">🧾</div>
      <h3 style="margin:0">Reçu de Paiement</h3>
      <p class="mu" style="font-size:12px;">FuelManager — Station-service</p>

      <div class="receipt-preview" style="text-align:left; margin:16px 0;">
        <div class="row"><span>Ticket N° :</span><b>${esc(sale.numeroRecu)}</b></div>
        <div class="row"><span>Date :</span><span>${new Date(sale.dateHeure).toLocaleString('fr-FR')}</span></div>
        <div class="row"><span>Pompe :</span><b>${esc(sale.pompeNumero)}</b></div>
        <div class="row"><span>Produit :</span><b>${esc(sale.carburant)}</b></div>
        <div class="row"><span>Prix / L :</span><span>${sale.prixUnitaire.toFixed(3)} DT</span></div>
        <div class="row"><span>Quantité :</span><b>${sale.quantite.toFixed(2)} Litres</b></div>
        <div class="row"><span>Règlement :</span><span>${esc(sale.modePaiement)}</span></div>
        <div style="border-top:1px dashed var(--bd); margin-top:10px; padding-top:8px;">
          <div class="row" style="font-size:18px; font-weight:700;">
            <span>TOTAL :</span>
            <span style="color:var(--ac);">${sale.montant.toFixed(3)} DT</span>
          </div>
        </div>
      </div>

      <div class="dialog-actions" style="justify-content:center;">
        <button type="button" onclick="$('#dlg').close(); setPage('pos');">Nouvelle Vente</button>
        <button type="button" class="p" onclick="window.print()">🖨️ Imprimer Reçu</button>
      </div>
    </div>
  `;
  $('#dlg').showModal();
}

/* ==========================================================================
   VIEW 10: SALES HISTORY (US 26, 27, 28)
   ========================================================================== */
async function renderSales() {
  const stationId = state.user.stationId;
  const sales = await API.sales.list(stationId ? { stationId } : {});

  const totalMontant = sales.reduce((acc, s) => acc + (s.montant || 0), 0);
  const totalLiters = sales.reduce((acc, s) => acc + (s.quantite || 0), 0);

  return `
    <div class="top-bar">
      <div>
        <h2>Historique des Ventes</h2>
        <div class="subtitle">Traçabilité complète des transactions de carburant (Sprint 2 — US 26 à 28).</div>
      </div>
      <div>
        <span class="badge neutral" style="font-size:14px; padding:6px 14px;">
          Volume : <b>${totalLiters.toFixed(1)} L</b>
        </span>
        <span class="badge suc" style="font-size:14px; padding:6px 14px; margin-left:8px;">
          Recette : <b>${totalMontant.toFixed(3)} DT</b>
        </span>
      </div>
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>N° Reçu</th>
            <th>Date &amp; Heure</th>
            <th>Station</th>
            <th>Pompe</th>
            <th>Carburant</th>
            <th>Quantité</th>
            <th>Prix Unit.</th>
            <th>Total Montant</th>
            <th>Règlement</th>
            <th>Caissier</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(s => `
            <tr>
              <td><code>${esc(s.numeroRecu)}</code></td>
              <td>${new Date(s.dateHeure).toLocaleString('fr-FR')}</td>
              <td>${esc(s.stationNom)}</td>
              <td><b>Pompe #${s.pompeNumero}</b></td>
              <td><b>${esc(s.carburant)}</b></td>
              <td>${s.quantite.toFixed(2)} L</td>
              <td>${s.prixUnitaire.toFixed(3)} DT</td>
              <td><b style="color:var(--ac); font-size:15px;">${s.montant.toFixed(3)} DT</b></td>
              <td><span class="badge neutral">${esc(s.modePaiement || 'Espèces')}</span></td>
              <td>${esc(s.employeNom)}</td>
            </tr>
          `).join('') || `<tr><td colspan="10" class="mu" style="text-align:center">Aucune vente enregistrée.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   VIEW 11: USERS & ROLES (US 5)
   ========================================================================== */
async function renderUsers() {
  const [users, stations] = await Promise.all([
    API.users.list(),
    API.stations.list()
  ]);

  state.cache.stations = stations;

  return `
    <div class="top-bar">
      <div>
        <h2>Gestion des Utilisateurs &amp; Rôles</h2>
        <div class="subtitle">Attribution des rôles et affectation aux stations-service (Sprint 1 — US 5).</div>
      </div>
      <button class="p" onclick="openNewUserModal()">+ Nouvel utilisateur</button>
    </div>

    <div class="card tw">
      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>E-mail</th>
            <th>Téléphone</th>
            <th>Rôle</th>
            <th>Station affectée</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="av" style="width:28px; height:28px; font-size:12px;">${esc((u.prenom || u.nom).charAt(0)).toUpperCase()}</div>
                  <b>${esc(u.prenom ? `${u.prenom} ${u.nom}` : u.nom)}</b>
                </div>
              </td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.telephone || '—')}</td>
              <td>
                <select ${u.id === state.user.id ? 'disabled' : ''} onchange="updateUserRole(${u.id}, this.value)" style="width:auto; padding:6px 10px;">
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 Administrateur</option>
                  <option value="gerant" ${u.role === 'gerant' ? 'selected' : ''}>🏬 Gérant de station</option>
                  <option value="employe" ${u.role === 'employe' ? 'selected' : ''}>⛽ Employé</option>
                </select>
              </td>
              <td>
                <select onchange="updateUserStation(${u.id}, this.value)" style="width:auto; padding:6px 10px;">
                  <option value="">— Aucune station —</option>
                  ${stations.map(s => `<option value="${s.id}" ${u.stationId === s.id ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}
                </select>
              </td>
              <td class="a">
                ${u.id !== state.user.id ? `
                  <button class="d" onclick="deleteUser(${u.id})">Supprimer</button>
                ` : '<span class="mu">(Vous)</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function updateUserRole(userId, newRole) {
  try {
    await API.users.update(userId, { role: newRole });
    toast('Rôle modifié avec succès !', 'success');
  } catch (err) {
    toast(err.message, 'error');
    render();
  }
}

async function updateUserStation(userId, newStationId) {
  try {
    await API.users.update(userId, { stationId: newStationId ? Number(newStationId) : null });
    toast('Affectation de station mise à jour !', 'success');
  } catch (err) {
    toast(err.message, 'error');
    render();
  }
}

async function deleteUser(userId) {
  if (!confirm('Supprimer cet utilisateur ?')) return;
  try {
    await API.users.delete(userId);
    toast('Utilisateur supprimé.', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openNewUserModal() {
  const stations = state.cache.stations;

  $('#dlg').innerHTML = `
    <form onsubmit="handleNewUserSubmit(event)">
      <h3 style="margin-top:0">Créer un nouvel utilisateur</h3>

      <div class="form-grid">
        <div>
          <label>Nom *</label>
          <input id="u_nom" required placeholder="Ex: Trabelsi">
        </div>
        <div>
          <label>Prénom</label>
          <input id="u_prenom" placeholder="Ex: Mourad">
        </div>
      </div>

      <label>Adresse E-mail *</label>
      <input id="u_mail" type="email" required placeholder="nom@fuelmanager.tn">

      <label>Mot de passe initial *</label>
      <input id="u_pw" type="password" required minlength="6" value="password123">

      <div class="form-grid">
        <div>
          <label>Rôle *</label>
          <select id="u_role">
            <option value="employe">Employé</option>
            <option value="gerant">Gérant de station</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        <div>
          <label>Station de rattachement</label>
          <select id="u_station">
            <option value="">— Non affecté —</option>
            ${stations.map(s => `<option value="${s.id}">${esc(s.nom)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="err" id="dlg_err"></div>

      <div class="dialog-actions">
        <button type="button" onclick="$('#dlg').close()">Annuler</button>
        <button type="submit" class="p">Créer le compte</button>
      </div>
    </form>
  `;
  $('#dlg').showModal();
}

async function handleNewUserSubmit(e) {
  e.preventDefault();
  const errBox = $('#dlg_err');
  errBox.textContent = '';

  const data = {
    nom: $('#u_nom').value.trim(),
    prenom: ($('#u_prenom').value || '').trim(),
    email: $('#u_mail').value.trim(),
    motDePasse: $('#u_pw').value,
    role: $('#u_role').value,
    stationId: $('#u_station').value ? Number($('#u_station').value) : null
  };

  try {
    await API.users.create(data);
    toast('Utilisateur créé avec succès !', 'success');
    $('#dlg').close();
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

/* ==========================================================================
   VIEW 12: PROFILE (US 4)
   ========================================================================== */
function renderProfile() {
  const u = state.user;
  return `
    <div class="top-bar">
      <div>
        <h2>Mon Profil</h2>
        <div class="subtitle">Modifier vos coordonnées et mot de passe (Sprint 1 — US 4).</div>
      </div>
    </div>

    <div class="card" style="max-width: 520px;">
      <form onsubmit="handleProfileSubmit(event)">
        <div class="form-grid">
          <div>
            <label>Nom</label>
            <input id="p_nom" required value="${esc(u.nom || '')}">
          </div>
          <div>
            <label>Prénom</label>
            <input id="p_prenom" value="${esc(u.prenom || '')}">
          </div>
        </div>

        <label>Adresse E-mail</label>
        <input id="p_mail" type="email" required value="${esc(u.email || '')}">

        <label>Téléphone</label>
        <input id="p_tel" value="${esc(u.telephone || '')}" placeholder="+216 ...">

        <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
        <input id="p_pw" type="password" minlength="6" placeholder="••••••••">

        <div style="margin-top:14px; font-size:13px; color:var(--mu);">
          Rôle : <b>${ROLES[u.role] || u.role}</b><br>
          ${u.station ? `Station : <b>${esc(u.station.nom)}</b>` : 'Aucune station rattachée'}
        </div>

        <div class="err" id="prof_err"></div>

        <button type="submit" class="p" style="margin-top:16px;">
          Enregistrer les modifications
        </button>
      </form>
    </div>
  `;
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  const errBox = $('#prof_err');
  errBox.textContent = '';

  const data = {
    nom: $('#p_nom').value.trim(),
    prenom: $('#p_prenom').value.trim(),
    email: $('#p_mail').value.trim(),
    telephone: $('#p_tel').value.trim()
  };

  const pw = $('#p_pw').value;
  if (pw && pw.length > 0) {
    data.motDePasse = pw;
  }

  try {
    const res = await API.auth.profile(data);
    state.user = res.user;
    toast('Profil mis à jour !', 'success');
    render();
  } catch (err) {
    errBox.textContent = err.message;
  }
}

// Start app
window.addEventListener('DOMContentLoaded', init);

