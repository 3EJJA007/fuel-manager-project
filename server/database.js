import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../data/db.json');

const INITIAL_DATA = {
  users: [
    {
      id: 1,
      nom: "Admin",
      prenom: "Principal",
      email: "admin@fuelmanager.tn",
      motDePasse: bcrypt.hashSync("admin123", 10),
      role: "admin",
      stationId: null,
      telephone: "+216 71 100 200",
      dateCreation: new Date("2026-10-01T08:00:00Z").toISOString()
    },
    {
      id: 2,
      nom: "Gérant",
      prenom: "Charguia",
      email: "gerant.charguia@fuelmanager.tn",
      motDePasse: bcrypt.hashSync("gerant123", 10),
      role: "gerant",
      stationId: 1,
      telephone: "+216 98 123 456",
      dateCreation: new Date("2026-10-02T09:00:00Z").toISOString()
    },
    {
      id: 3,
      nom: "Gérant",
      prenom: "Lac 2",
      email: "gerant.lac@fuelmanager.tn",
      motDePasse: bcrypt.hashSync("gerant123", 10),
      role: "gerant",
      stationId: 2,
      telephone: "+216 98 654 321",
      dateCreation: new Date("2026-10-03T10:00:00Z").toISOString()
    },
    {
      id: 4,
      nom: "Employé",
      prenom: "Ahmed",
      email: "employe.charguia@fuelmanager.tn",
      motDePasse: bcrypt.hashSync("employe123", 10),
      role: "employe",
      stationId: 1,
      telephone: "+216 55 444 333",
      dateCreation: new Date("2026-10-05T07:30:00Z").toISOString()
    },
    {
      id: 5,
      nom: "Employé",
      prenom: "Sami",
      email: "employe.lac@fuelmanager.tn",
      motDePasse: bcrypt.hashSync("employe123", 10),
      role: "employe",
      stationId: 2,
      telephone: "+216 50 111 222",
      dateCreation: new Date("2026-10-05T07:30:00Z").toISOString()
    }
  ],
  stations: [
    {
      id: 1,
      nom: "Station ISET Charguia",
      adresse: "Rue de l'Aéroport, Charguia II",
      ville: "Tunis",
      telephone: "+216 71 800 100",
      etat: "Active",
      dateCreation: new Date("2026-10-01T08:00:00Z").toISOString()
    },
    {
      id: 2,
      nom: "Station Total Lac 2",
      adresse: "Les Berges du Lac 2, Voie Express",
      ville: "Tunis",
      telephone: "+216 71 800 200",
      etat: "Active",
      dateCreation: new Date("2026-10-02T08:00:00Z").toISOString()
    },
    {
      id: 3,
      nom: "Station Agil Ariana",
      adresse: "Avenue Habib Bourguiba",
      ville: "Ariana",
      telephone: "+216 71 800 300",
      etat: "Active",
      dateCreation: new Date("2026-10-03T08:00:00Z").toISOString()
    }
  ],
  fuels: [
    {
      id: 1,
      libelle: "Sans Plomb 95",
      prixUnitaire: 2.525,
      seuilMinimal: 3500,
      description: "Carburant essence super sans plomb indice d'octane 95",
      couleur: "#10b981"
    },
    {
      id: 2,
      libelle: "Gasoil 50",
      prixUnitaire: 2.200,
      seuilMinimal: 4000,
      description: "Gasoil désulfuré haute performance (50 ppm)",
      couleur: "#f59e0b"
    },
    {
      id: 3,
      libelle: "Gasoil Ordinaire",
      prixUnitaire: 1.980,
      seuilMinimal: 2500,
      description: "Gasoil standard pour véhicules lourds et utilitaires",
      couleur: "#3b82f6"
    }
  ],
  pumps: [
    { id: 1, stationId: 1, numero: 1, carburantId: 1, etat: "En service", description: "Îlot A - Piste Voitures" },
    { id: 2, stationId: 1, numero: 2, carburantId: 2, etat: "En service", description: "Îlot A - Piste Voitures" },
    { id: 3, stationId: 1, numero: 3, carburantId: 3, etat: "En service", description: "Îlot B - Poids Lourds" },
    { id: 4, stationId: 1, numero: 4, carburantId: 1, etat: "Maintenance", description: "Îlot B - Pompage Rapide" },
    { id: 5, stationId: 2, numero: 1, carburantId: 1, etat: "En service", description: "Borne 1" },
    { id: 6, stationId: 2, numero: 2, carburantId: 2, etat: "En service", description: "Borne 2" }
  ],
  tanks: [
    { id: 1, stationId: 1, carburantId: 1, capacite: 20000, niveauActuel: 14200, dateMiseEnService: "2024-01-15" },
    { id: 2, stationId: 1, carburantId: 2, capacite: 25000, niveauActuel: 6800, dateMiseEnService: "2024-01-15" },
    { id: 3, stationId: 1, carburantId: 3, capacite: 15000, niveauActuel: 2100, dateMiseEnService: "2024-01-15" }, // Under seuil (2500) -> Alert!
    { id: 4, stationId: 2, carburantId: 1, capacite: 20000, niveauActuel: 16500, dateMiseEnService: "2024-05-10" },
    { id: 5, stationId: 2, carburantId: 2, capacite: 20000, niveauActuel: 11000, dateMiseEnService: "2024-05-10" }
  ],
  suppliers: [
    {
      id: 1,
      nom: "SNDP AGIL Tunisie",
      telephone: "+216 71 700 800",
      email: "contact@agil.com.tn",
      adresse: "Zone Pétrolière Radès, Tunis",
      matriculeFiscale: "0001234A/M/000"
    },
    {
      id: 2,
      nom: "TotalEnergies Tunisie",
      telephone: "+216 71 180 000",
      email: "service.livraison@totalenergies.tn",
      adresse: "Zone Industrielle Saint-Gobain, Tunis",
      matriculeFiscale: "0005678B/M/000"
    },
    {
      id: 3,
      nom: "Ola Energy Tunisie",
      telephone: "+216 71 860 123",
      email: "commandes@olaenergy.com.tn",
      adresse: "Les Berges du Lac, Tunis",
      matriculeFiscale: "0009999C/M/000"
    }
  ],
  deliveries: [
    {
      id: 1,
      numeroBon: "BL-2026-001",
      stationId: 1,
      cuveId: 1,
      carburantId: 1,
      fournisseurId: 1,
      quantite: 5000,
      prixAchat: 2.150,
      date: "2026-10-25T10:30:00Z",
      notes: "Livraison citerne semi-remorque A3"
    },
    {
      id: 2,
      numeroBon: "BL-2026-002",
      stationId: 1,
      cuveId: 2,
      carburantId: 2,
      fournisseurId: 2,
      quantite: 6000,
      prixAchat: 1.850,
      date: "2026-10-26T14:15:00Z",
      notes: "Livraison standard sans réserve"
    }
  ],
  sales: [
    {
      id: 1,
      numeroRecu: "REC-1001",
      stationId: 1,
      pompeId: 1,
      cuveId: 1,
      carburantId: 1,
      employeId: 4,
      quantite: 40.0,
      prixUnitaire: 2.525,
      montant: 101.0,
      dateHeure: "2026-10-29T10:05:00Z",
      modePaiement: "Espèces"
    },
    {
      id: 2,
      numeroRecu: "REC-1002",
      stationId: 1,
      pompeId: 2,
      cuveId: 2,
      carburantId: 2,
      employeId: 4,
      quantite: 55.0,
      prixUnitaire: 2.200,
      montant: 121.0,
      dateHeure: "2026-10-29T11:20:00Z",
      modePaiement: "Carte Bancaire"
    },
    {
      id: 3,
      numeroRecu: "REC-1003",
      stationId: 1,
      pompeId: 3,
      cuveId: 3,
      carburantId: 3,
      employeId: 4,
      quantite: 70.0,
      prixUnitaire: 1.980,
      montant: 138.6,
      dateHeure: "2026-10-29T15:45:00Z",
      modePaiement: "Espèces"
    }
  ],
  stock_movements: [
    {
      id: 1,
      dateHeure: "2026-10-25T10:30:00Z",
      stationId: 1,
      cuveId: 1,
      carburantId: 1,
      type: "ENTREE_LIVRAISON",
      quantite: 5000,
      ancienNiveau: 9200,
      nouveauNiveau: 14200,
      referenceId: "BL-2026-001",
      auteur: "Gérant Charguia"
    },
    {
      id: 2,
      dateHeure: "2026-10-29T10:05:00Z",
      stationId: 1,
      cuveId: 1,
      carburantId: 1,
      type: "SORTIE_VENTE",
      quantite: 40,
      ancienNiveau: 14240,
      nouveauNiveau: 14200,
      referenceId: "REC-1001",
      auteur: "Employé Ahmed"
    }
  ]
};

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf8');
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      } else {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(raw);
        // Ensure all collections exist
        for (const key of Object.keys(INITIAL_DATA)) {
          if (!this.data[key]) {
            this.data[key] = INITIAL_DATA[key];
          }
        }
      }
    } catch (err) {
      console.error('Error loading DB, creating fresh state:', err);
      this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save DB file:', err);
    }
  }

  collection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
      this.save();
    }
    return this.data[name];
  }

  nextId(name) {
    const coll = this.collection(name);
    if (!coll.length) return 1;
    const max = Math.max(...coll.map(item => Number(item.id) || 0));
    return max + 1;
  }

  find(name, predicate) {
    return this.collection(name).find(predicate);
  }

  filter(name, predicate) {
    return this.collection(name).filter(predicate);
  }

  findById(name, id) {
    return this.collection(name).find(item => item.id === Number(id));
  }

  insert(name, item) {
    const coll = this.collection(name);
    const newId = item.id || this.nextId(name);
    const newItem = { ...item, id: newId };
    coll.push(newItem);
    this.save();
    return newItem;
  }

  update(name, id, patch) {
    const coll = this.collection(name);
    const index = coll.findIndex(item => item.id === Number(id));
    if (index === -1) return null;
    coll[index] = { ...coll[index], ...patch, id: Number(id) };
    this.save();
    return coll[index];
  }

  delete(name, id) {
    const coll = this.collection(name);
    const index = coll.findIndex(item => item.id === Number(id));
    if (index === -1) return false;
    coll.splice(index, 1);
    this.save();
    return true;
  }

  resetToInitial() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.save();
    return this.data;
  }
}

export const db = new Database();

