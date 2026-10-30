import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool, Client } = pg;

// PostgreSQL connection config
export const dbConfig = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'fuel_manager_db'
};

export let pool = null;

// Ensure database exists and schema is up to date
export async function initPostgres() {
  // 1. Check if fuel_manager_db exists, create if not
  try {
    const adminClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'postgres'
    });
    await adminClient.connect();
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbConfig.database]
    );
    if (res.rows.length === 0) {
      console.log(`[PostgreSQL] Création de la base de données "${dbConfig.database}"...`);
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`[PostgreSQL] Base "${dbConfig.database}" créée avec succès.`);
    }
    await adminClient.end();
  } catch (err) {
    console.warn('[PostgreSQL] Note lors de la vérification initiale de la DB:', err.message);
  }

  // 2. Connect to fuel_manager_db
  pool = new Pool(dbConfig);
  const client = await pool.connect();
  console.log(`[PostgreSQL] Connecté à la base "${dbConfig.database}" sur le port ${dbConfig.port}`);

  try {
    // 3. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS stations (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(150) NOT NULL UNIQUE,
        adresse VARCHAR(255) NOT NULL,
        ville VARCHAR(100) NOT NULL,
        telephone VARCHAR(50),
        etat VARCHAR(20) DEFAULT 'Active',
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100),
        email VARCHAR(150) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'employe',
        station_id INT REFERENCES stations(id) ON DELETE SET NULL,
        telephone VARCHAR(50),
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fuels (
        id SERIAL PRIMARY KEY,
        libelle VARCHAR(100) UNIQUE NOT NULL,
        prix_unitaire NUMERIC(10, 3) NOT NULL,
        seuil_minimal INT DEFAULT 3000,
        description TEXT,
        couleur VARCHAR(20) DEFAULT '#ff4d2e'
      );

      CREATE TABLE IF NOT EXISTS pumps (
        id SERIAL PRIMARY KEY,
        station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        numero INT NOT NULL,
        carburant_id INT NOT NULL REFERENCES fuels(id) ON DELETE RESTRICT,
        etat VARCHAR(30) DEFAULT 'En service',
        description VARCHAR(255),
        CONSTRAINT unique_pump_per_station UNIQUE (station_id, numero)
      );

      CREATE TABLE IF NOT EXISTS tanks (
        id SERIAL PRIMARY KEY,
        station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        carburant_id INT NOT NULL REFERENCES fuels(id) ON DELETE RESTRICT,
        capacite NUMERIC(12, 2) NOT NULL,
        niveau_actuel NUMERIC(12, 2) NOT NULL DEFAULT 0,
        date_mise_en_service DATE DEFAULT CURRENT_DATE
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(150) UNIQUE NOT NULL,
        telephone VARCHAR(50),
        email VARCHAR(150),
        adresse VARCHAR(255),
        matricule_fiscale VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        numero_bon VARCHAR(100) UNIQUE NOT NULL,
        station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        cuve_id INT NOT NULL REFERENCES tanks(id) ON DELETE RESTRICT,
        carburant_id INT NOT NULL REFERENCES fuels(id) ON DELETE RESTRICT,
        fournisseur_id INT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        quantite NUMERIC(12, 2) NOT NULL,
        prix_achat NUMERIC(10, 3) DEFAULT 0,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        numero_recu VARCHAR(100) UNIQUE NOT NULL,
        station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        pompe_id INT REFERENCES pumps(id) ON DELETE SET NULL,
        cuve_id INT REFERENCES tanks(id) ON DELETE SET NULL,
        carburant_id INT NOT NULL REFERENCES fuels(id) ON DELETE RESTRICT,
        employe_id INT REFERENCES users(id) ON DELETE SET NULL,
        quantite NUMERIC(12, 2) NOT NULL,
        prix_unitaire NUMERIC(10, 3) NOT NULL,
        montant NUMERIC(12, 3) NOT NULL,
        date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mode_paiement VARCHAR(50) DEFAULT 'Espèces'
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        station_id INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        cuve_id INT REFERENCES tanks(id) ON DELETE CASCADE,
        carburant_id INT NOT NULL REFERENCES fuels(id) ON DELETE RESTRICT,
        type VARCHAR(50) NOT NULL,
        quantite NUMERIC(12, 2) NOT NULL,
        ancien_niveau NUMERIC(12, 2) NOT NULL,
        nouveau_niveau NUMERIC(12, 2) NOT NULL,
        reference_id VARCHAR(100),
        auteur VARCHAR(150)
      );
    `);

    // 4. Check if data exists, if not seed
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
      console.log('[PostgreSQL] Amorçage initial des données de démonstration...');
      await seedPostgres(client);
      console.log('[PostgreSQL] Données de démonstration insérées avec succès.');
    }
  } finally {
    client.release();
  }
}

export async function seedPostgres(client) {
  // 1. Stations
  await client.query(`
    INSERT INTO stations (id, nom, adresse, ville, telephone, etat) VALUES
      (1, 'Station ISET Charguia', 'Rue de l''Aéroport, Charguia II', 'Tunis', '+216 71 800 100', 'Active'),
      (2, 'Station Total Lac 2', 'Les Berges du Lac 2, Voie Express', 'Tunis', '+216 71 800 200', 'Active'),
      (3, 'Station Agil Ariana', 'Avenue Habib Bourguiba', 'Ariana', '+216 71 800 300', 'Active')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('stations_id_seq', (SELECT MAX(id) FROM stations));
  `);

  // 2. Users
  const passAdmin = bcrypt.hashSync('admin123', 10);
  const passGerant = bcrypt.hashSync('gerant123', 10);
  const passEmploye = bcrypt.hashSync('employe123', 10);

  await client.query(`
    INSERT INTO users (id, nom, prenom, email, mot_de_passe, role, station_id, telephone) VALUES
      (1, 'Admin', 'Principal', 'admin@fuelmanager.tn', '${passAdmin}', 'admin', NULL, '+216 71 100 200'),
      (2, 'Gérant', 'Charguia', 'gerant.charguia@fuelmanager.tn', '${passGerant}', 'gerant', 1, '+216 98 123 456'),
      (3, 'Gérant', 'Lac 2', 'gerant.lac@fuelmanager.tn', '${passGerant}', 'gerant', 2, '+216 98 654 321'),
      (4, 'Employé', 'Ahmed', 'employe.charguia@fuelmanager.tn', '${passEmploye}', 'employe', 1, '+216 55 444 333'),
      (5, 'Employé', 'Sami', 'employe.lac@fuelmanager.tn', '${passEmploye}', 'employe', 2, '+216 50 111 222')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
  `);

  // 3. Fuels
  await client.query(`
    INSERT INTO fuels (id, libelle, prix_unitaire, seuil_minimal, description, couleur) VALUES
      (1, 'Sans Plomb 95', 2.525, 3500, 'Carburant essence super sans plomb indice d''octane 95', '#10b981'),
      (2, 'Gasoil 50', 2.200, 4000, 'Gasoil désulfuré haute performance (50 ppm)', '#f59e0b'),
      (3, 'Gasoil Ordinaire', 1.980, 2500, 'Gasoil standard pour véhicules lourds et utilitaires', '#3b82f6')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('fuels_id_seq', (SELECT MAX(id) FROM fuels));
  `);

  // 4. Pumps
  await client.query(`
    INSERT INTO pumps (id, station_id, numero, carburant_id, etat, description) VALUES
      (1, 1, 1, 1, 'En service', 'Îlot A - Piste Voitures'),
      (2, 1, 2, 2, 'En service', 'Îlot A - Piste Voitures'),
      (3, 1, 3, 3, 'En service', 'Îlot B - Poids Lourds'),
      (4, 1, 4, 1, 'Maintenance', 'Îlot B - Pompage Rapide'),
      (5, 2, 1, 1, 'En service', 'Borne 1'),
      (6, 2, 2, 2, 'En service', 'Borne 2')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('pumps_id_seq', (SELECT MAX(id) FROM pumps));
  `);

  // 5. Tanks
  await client.query(`
    INSERT INTO tanks (id, station_id, carburant_id, capacite, niveau_actuel, date_mise_en_service) VALUES
      (1, 1, 1, 20000, 14200, '2024-01-15'),
      (2, 1, 2, 25000, 6800, '2024-01-15'),
      (3, 1, 3, 15000, 2100, '2024-01-15'),
      (4, 2, 1, 20000, 16500, '2024-05-10'),
      (5, 2, 2, 20000, 11000, '2024-05-10')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('tanks_id_seq', (SELECT MAX(id) FROM tanks));
  `);

  // 6. Suppliers
  await client.query(`
    INSERT INTO suppliers (id, nom, telephone, email, adresse, matricule_fiscale) VALUES
      (1, 'SNDP AGIL Tunisie', '+216 71 700 800', 'contact@agil.com.tn', 'Zone Pétrolière Radès, Tunis', '0001234A/M/000'),
      (2, 'TotalEnergies Tunisie', '+216 71 180 000', 'service.livraison@totalenergies.tn', 'Zone Industrielle Saint-Gobain, Tunis', '0005678B/M/000'),
      (3, 'Ola Energy Tunisie', '+216 71 860 123', 'commandes@olaenergy.com.tn', 'Les Berges du Lac, Tunis', '0009999C/M/000')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('suppliers_id_seq', (SELECT MAX(id) FROM suppliers));
  `);

  // 7. Deliveries
  await client.query(`
    INSERT INTO deliveries (id, numero_bon, station_id, cuve_id, carburant_id, fournisseur_id, quantite, prix_achat, notes) VALUES
      (1, 'BL-2026-001', 1, 1, 1, 1, 5000, 2.150, 'Livraison citerne semi-remorque A3'),
      (2, 'BL-2026-002', 1, 2, 2, 2, 6000, 1.850, 'Livraison standard sans réserve')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('deliveries_id_seq', (SELECT MAX(id) FROM deliveries));
  `);

  // 8. Sales
  await client.query(`
    INSERT INTO sales (id, numero_recu, station_id, pompe_id, cuve_id, carburant_id, employe_id, quantite, prix_unitaire, montant, mode_paiement) VALUES
      (1, 'REC-1001', 1, 1, 1, 1, 4, 40.0, 2.525, 101.0, 'Espèces'),
      (2, 'REC-1002', 1, 2, 2, 2, 4, 55.0, 2.200, 121.0, 'Carte Bancaire'),
      (3, 'REC-1003', 1, 3, 3, 3, 4, 70.0, 1.980, 138.6, 'Espèces')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('sales_id_seq', (SELECT MAX(id) FROM sales));
  `);

  // 9. Stock movements
  await client.query(`
    INSERT INTO stock_movements (id, station_id, cuve_id, carburant_id, type, quantite, ancien_niveau, nouveau_niveau, reference_id, auteur) VALUES
      (1, 1, 1, 1, 'ENTREE_LIVRAISON', 5000, 9200, 14200, 'BL-2026-001', 'Gérant Charguia'),
      (2, 1, 1, 1, 'SORTIE_VENTE', 40, 14240, 14200, 'REC-1001', 'Employé Ahmed')
    ON CONFLICT (id) DO NOTHING;
    SELECT setval('stock_movements_id_seq', (SELECT MAX(id) FROM stock_movements));
  `);
}

// Query helper
export async function query(text, params) {
  return pool.query(text, params);
}
