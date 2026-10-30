# ⛽ FUEL//MANAGER — Application Web de Gestion de Stations-Service
> **Projet d'Intégration Web (Sprint 1 & Sprint 2)**  
> **Établissement :** Institut Supérieur des Études Technologiques de Charguia (ISET Charguia)  
> **Département :** Technologies de l'Informatique  
> **Architecture :** **Angular 21** (Frontend) + **Node.js / Express** (Backend REST) + **PostgreSQL 18** (Base de données en direct avec pgAdmin)  
> **Réalisé par :** Noussair Huimli, Rayen Bakey, Koussay Ghriss  
> **Encadré par :** Mme Sonia Gannar  
> **Année universitaire :** 2026 – 2027  

---

## 🌟 Technologies Utilisées

| Composant | Technologie | Description |
| :--- | :--- | :--- |
| **Frontend** | **Angular 21 & TypeScript** | Composants autonomes (Standalone), services injectables, typage fort, Space Grotesk, mode clair/sombre |
| **Backend** | **Node.js & Express.js** | API REST modulaire avec authentification **JWT**, sécurité **bcrypt**, contrôle des rôles (RBAC) |
| **Base de Données** | **PostgreSQL 18 (Live)** | Schéma relationnel complet avec clés étrangères, contraintes d'unicité, transactions atomiques (ACID) |
| **Administration SGBD** | **pgAdmin 4** | Visualisation et gestion en temps réel de la base `fuel_manager_db` |

---

## 🐘 Visualisation dans pgAdmin 4

La base de données est configurée sur votre instance PostgreSQL locale (`127.0.0.1:5432`) :
1. Ouvrez **pgAdmin 4**.
2. Déroulez le serveur PostgreSQL 18 : vous trouverez la base **`fuel_manager_db`**.
3. Dans **Schemas > public > Tables**, vous retrouverez les 9 tables créées et alimentées en direct :
   - `stations` : Liste des stations-service
   - `users` : Comptes utilisateurs avec rôles (`admin`, `gerant`, `employe`)
   - `fuels` : Types de carburant, prix au litre et seuils minimaux
   - `pumps` : Pompes de distribution rattachées aux carburants
   - `tanks` : Cuves de stockage avec capacité et niveau actuel
   - `suppliers` : Fournisseurs pétroliers partenaires
   - `deliveries` : Bons de livraison et approvisionnements
   - `sales` : Ventes de carburant enregistrées à la caisse
   - `stock_movements` : Journal d'audit des entrées et sorties de carburant

---

## 🚀 Démarrage de l'Application

### En 1 Clic (Recommandé) :
Double-cliquez sur le fichier **`start.bat`** :
- Il vérifie PostgreSQL et les dépendances.
- Il démarre l'application complète sur **`http://localhost:3000`**.
- Il ouvre automatiquement votre navigateur web !

### En Ligne de Commande :
```bash
# Lancement de l'application complète (Backend + Angular + PostgreSQL)
npm start
```
Puis accédez à : **`http://localhost:3000`**

*(Optionnel) Si vous souhaitez lancer le serveur de développement Angular à part :*
```bash
npm run dev:angular
# Accessible sur http://localhost:4200
```

---

## 🔑 Comptes de Test (Soutenance)

Sur l'écran de connexion, 3 boutons rapides permettent de se connecter sans taper d'identifiants :

| Rôle | E-mail | Mot de passe | Station affectée | Accès & Rôle |
| :--- | :--- | :--- | :--- | :--- |
| **👑 Administrateur** | `admin@fuelmanager.tn` | `admin123` | *Toutes* | Pilotage réseau, stations, carburants, prix, seuils, utilisateurs, fournisseurs, stats globales |
| **🏬 Gérant de Station** | `gerant.charguia@fuelmanager.tn` | `gerant123` | Station ISET Charguia | Gestion pompes, cuves, réception livraisons (+ entrées stock) et jauges de remplissage |
| **⛽ Employé de Piste** | `employe.charguia@fuelmanager.tn` | `employe123` | Station ISET Charguia | Caisse rapide POS : sélection pompe, calcul automatique du montant, impression ticket de caisse |

---

## 📋 Couverture Intégrale des Sprints 1 & 2

### 🔹 Sprint 1 : Authentification, Rôles & Configuration du Réseau
- **US 1 à 4 :** Inscription, connexion sécurisée avec jeton JWT, déconnexion, modification de profil et mot de passe chiffré (bcrypt).
- **US 5 :** Attribution et modification des rôles et affectation aux stations-service par l'administrateur.
- **US 6 à 9 :** CRUD complet des stations du réseau (nom, adresse, ville, téléphone, état).
- **US 10 à 13 :** Gestion des carburants (*Sans Plomb 95*, *Gasoil 50*, *Gasoil Ordinaire*) et tarification en Dinars Tunisiens (DT/L).
- **US 14 à 16 :** Gestion des pompes et suivi de leur état de fonctionnement (*En service*, *Hors service*, *Maintenance*).
- **US 17 à 19 :** Gestion des cuves avec capacité et niveau actuel.

### 🔹 Sprint 2 : Approvisionnements, Ventes & Suivi du Stock
- **US 20 à 23 :** CRUD des compagnies pétrolières fournisseurs (SNDP AGIL, TotalEnergies, Ola Energy...).
- **US 24 & 25 :** Enregistrement des réceptions de carburant avec **incrémentation automatique et transactionnelle du stock en cuve** (`BEGIN` / `COMMIT` / `ROLLBACK`).
- **US 26, 27 & 28 :** Caisse POS rapide pour l'employé avec **calcul automatique du montant** ($\text{Quantité} \times \text{Prix}$), **vérification de disponibilité en stock** (rejet avec erreur 409 si stock insuffisant), **décrémentation automatique en cuve** et ticket imprimable.
- **US 29 & 30 :** Jauges visuelles colorées avec pourcentages et alertes si stock $\le$ seuil minimal (*Normal*, *Stock Faible*, *Stock Critique*).
- **Traçabilité :** Journal d'audit complet de tous les mouvements de stock dans la table PostgreSQL `stock_movements`.
