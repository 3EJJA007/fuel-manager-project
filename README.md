# ⛽ FUEL//MANAGER — Système de Gestion de Stations-Service
> **Projet d'Intégration Web (Sprint 1 & Sprint 2)**  
> **Établissement :** Institut Supérieur des Études Technologiques de Charguia (ISET Charguia)  
> **Département :** Technologies de l'Informatique  
> **Réalisé par :** Noussair Huimli, Rayen Bakey, Koussay Ghriss  
> **Encadré par :** Mme Sonia Gannar  
> **Année universitaire :** 2026 – 2027  

---

## 📋 Présentation du Projet
**FUEL//MANAGER** est une plateforme web moderne et intuitive conçue pour centraliser et automatiser les opérations quotidiennes d'une société de distribution de carburant et de son réseau de stations-service.

L'application intègre l'ensemble des besoins fonctionnels décrits dans les rapports du **Sprint 1** et du **Sprint 2**, avec une interface épurée respectant la charte graphique demandée (*Space Grotesk*, thème dynamique clair/sombre, accent énergique `#ff4d2e`, jauges de stock animées et caisse tactile rapide).

---

## 🎯 Couverture Fonctionnelle

### 🔹 Sprint 1 : Authentification, Gestion des Rôles & Configuration du Réseau
- **US 1 (Inscription) :** Création de compte avec nom, prénom, email et mot de passe sécurisé (hachage bcrypt).
- **US 2 (Authentification) :** Connexion sécurisée avec génération de jeton **JWT** et redirection selon le rôle.
- **US 3 (Déconnexion) :** Révocation de session côté client.
- **US 4 (Profil) :** Modification des coordonnées et mise à jour du mot de passe.
- **US 5 (Gestion des Rôles & Utilisateurs) :** L'administrateur attribue les rôles (`admin`, `gerant`, `employe`) et affecte les utilisateurs à leurs stations respectives.
- **US 6 à 9 (Gestion des Stations) :** CRUD complet des stations-service (nom, adresse, ville, téléphone, état actif/inactif).
- **US 10 à 13 (Types de Carburant & Tarifs) :** Définition des produits (Sans Plomb 95, Gasoil 50, etc.) et fixation des prix unitaires en Dinars Tunisiens (DT/L).
- **US 14 à 16 (Pompes de Distribution) :** Ajout, modification et consultation des pompes rattachées aux carburants avec suivi de leur état (*En service*, *Hors service*, *Maintenance*).
- **US 17 à 19 (Cuves de Stockage) :** Gestion des réservoirs de chaque station avec capacité nominale et niveau de remplissage en Litres.

### 🔹 Sprint 2 : Approvisionnements, Ventes & Suivi du Stock
- **US 20 à 23 (Gestion des Fournisseurs) :** CRUD des compagnies pétrolières partenaires (SNDP Agil, TotalEnergies, Ola Energy, etc.).
- **US 24 & 25 (Livraisons & Entrées en Stock) :** Enregistrement des bons de livraison par le gérant ; **incrémentation automatique** et instantanée du niveau de la cuve de stockage correspondante avec contrôle de surcapacité.
- **US 26, 27 & 28 (Ventes de Carburant & Sorties de Stock) :** 
  - Interface caisse rapide pour l'employé avec choix de la pompe et presets de litrage.
  - **Calcul automatique du montant net** : $\text{Montant} = \text{Quantité} \times \text{Prix Unitaire}$.
  - **Vérification de stock préalable** : rejet immédiat (*Code HTTP 409 - Stock insuffisant*) si la quantité demandée dépasse le niveau en cuve.
  - **Décrémentation automatique** du stock en cuve et génération d'un reçu imprimable.
- **US 29 (Consultation des Stocks) :** Jauges visuelles colorées en temps réel (pourcentage de remplissage, volume restant vs capacité totale).
- **US 30 (Seuils d'Alerte Minimaux) :** Définition de seuils minimaux par carburant avec badge et alertes visuelles (*Normal*, *Stock Faible*, *Stock Critique*).
- **Bonus (Traçabilité) :** Journal d'audit complet de tous les mouvements de stock (*Entrées Livraisons* vs *Sorties Ventes*).

---

## ⚡ Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure)

### Lancement en 1 commande
Ouvrez un terminal dans le dossier du projet :
```bash
# 1. Installer les dépendances (déjà fait si node_modules existe)
npm install

# 2. Démarrer le serveur
npm start
```

Rendez-vous ensuite sur votre navigateur à l'adresse :
👉 **`http://localhost:3000`**

---

## 🔑 Comptes de Démonstration (Prêts pour la Soutenance)

Des boutons de connexion rapide en 1 clic sont disponibles sur la page de connexion pour tester instantanément chaque profil :

| Rôle | E-mail | Mot de passe | Station affectée | Droits et Fonctionnalités |
| :--- | :--- | :--- | :--- | :--- |
| **Administrateur** | `admin@fuelmanager.tn` | `admin123` | *Toutes* | Gestion réseau, stations, carburants, prix, seuils, utilisateurs, fournisseurs, stats globales |
| **Gérant de Station** | `gerant.charguia@fuelmanager.tn` | `gerant123` | Station ISET Charguia | Gestion des pompes, cuves, réception des livraisons, suivi des stocks de la station |
| **Employé de Piste** | `employe.charguia@fuelmanager.tn` | `employe123` | Station ISET Charguia | Caisse rapide POS, enregistrement des ventes avec calcul auto, impression de ticket de caisse |

---

## 🛠️ Architecture Technique

```
gannar-project/
├── data/
│   ├── db.json               # Base de données persistante (données réelles & test)
│   └── seed.js               # Script de réinitialisation des données
├── server/
│   ├── database.js           # Gestionnaire d'accès aux données avec verrous atomiques
│   ├── middleware/
│   │   └── auth.js           # Middleware de vérification JWT & contrôle d'accès par rôle
│   └── routes/
│       ├── auth.js           # API Inscription, Connexion, Profil
│       ├── users.js          # API Gestion des utilisateurs & rôles (US 5)
│       ├── stations.js       # API Stations-service (US 6-9)
│       ├── fuels.js          # API Carburants, Tarifs & Seuils (US 10-13, US 30)
│       ├── pumps.js          # API Pompes de distribution (US 14-16)
│       ├── tanks.js          # API Cuves de stockage (US 17-19)
│       ├── suppliers.js      # API Fournisseurs (US 20-23)
│       ├── deliveries.js     # API Livraisons & incrémentation stock (US 24-25)
│       ├── sales.js          # API Ventes, calcul montant & décrémentation stock (US 26-28)
│       └── stats.js          # API Tableaux de bord, jauges de stock & mouvements
├── public/                   # Frontend SPA moderne (HTML5 / Vanilla JS / CSS3)
│   ├── css/
│   │   └── style.css         # Charte graphique Space Grotesk, thèmes Light/Dark
│   ├── js/
│   │   ├── api.js            # Client HTTP avec gestion du jeton JWT
│   │   └── app.js            # Contrôleur d'interface, formulaires dynamiques, POS Caisse
│   └── index.html            # Conteneur principal de l'application
├── package.json
├── server.js                 # Point d'entrée serveur Express (Port 3000)
└── README.md
```

---

## 📡 Endpoints REST Principaux

| Méthode | Endpoint | Description | Rôle Requis |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Inscription d'un nouvel utilisateur | Public |
| `POST` | `/api/auth/login` | Connexion & délivrance du token JWT | Public |
| `GET` | `/api/auth/me` | Informations du profil connecté | Authentifié |
| `PUT` | `/api/auth/profile` | Modification du profil et du mot de passe | Authentifié |
| `GET/POST` | `/api/stations` | Consultation et création de stations | Admin |
| `GET/POST` | `/api/fuels` | Catalogue carburants, prix et seuils | Admin / Tous |
| `GET/POST` | `/api/pumps` | Pompes de la station | Gérant / Admin |
| `GET/POST` | `/api/tanks` | Cuves et jauges de remplissage | Gérant / Admin |
| `GET/POST` | `/api/suppliers` | Fournisseurs de carburant | Admin / Gérant |
| `GET/POST` | `/api/deliveries` | Enregistrement de livraison (+ entrée stock) | Gérant / Admin |
| `GET/POST` | `/api/sales` | Vente de carburant (- sortie stock avec contrôle) | Employé / Tous |
| `GET` | `/api/stats/dashboard` | Indicateurs clés et synthèse quotidienne | Authentifié |
| `GET` | `/api/stats/stock-summary` | Jauges de stock par carburant et alertes | Authentifié |
| `GET` | `/api/stats/movements` | Journal d'audit des mouvements de stock | Authentifié |

