import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 19 & 29: Consulter les cuves
router.get('/', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
      if (!stationId) return res.status(403).json({ message: 'Vous n’êtes affecté à aucune station.' });
    }

    let queryText = `
      SELECT t.id, t.station_id as "stationId", t.carburant_id as "carburantId",
             t.capacite, t.niveau_actuel as "niveauActuel", t.date_mise_en_service as "dateMiseEnService",
             json_build_object('id', f.id, 'libelle', f.libelle, 'prixUnitaire', f.prix_unitaire, 'couleur', f.couleur, 'seuilMinimal', f.seuil_minimal) as carburant,
             json_build_object('id', s.id, 'nom', s.nom) as station
      FROM tanks t
      JOIN fuels f ON t.carburant_id = f.id
      JOIN stations s ON t.station_id = s.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE t.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY t.station_id ASC, t.id ASC';

    const result = await pool.query(queryText, params);
    const tanks = result.rows.map(t => {
      const cap = Number(t.capacite);
      const niv = Number(t.niveauActuel);
      const seuil = Number(t.carburant.seuilMinimal) || 3000;
      const pct = cap > 0 ? Math.round((niv / cap) * 100) : 0;
      return {
        ...t,
        capacite: cap,
        niveauActuel: niv,
        pourcentage: pct,
        seuilMinimal: seuil,
        estFaible: niv <= seuil,
        estCritique: niv <= (seuil * 0.5),
        carburant: {
          ...t.carburant,
          prixUnitaire: Number(t.carburant.prixUnitaire),
          seuilMinimal: seuil
        }
      };
    });

    res.json(tanks);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des cuves.' });
  }
});

// US 17: Ajouter une cuve
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
    if (!stationId) return res.status(400).json({ message: 'Station requise.' });

    const { carburantId, capacite, niveauActuel, dateMiseEnService } = req.body;
    if (!carburantId || capacite === undefined || capacite === '') {
      return res.status(400).json({ message: 'Carburant et capacité sont requis.' });
    }

    const cap = Number(capacite);
    const niv = Number(niveauActuel || 0);

    if (isNaN(cap) || cap <= 0) return res.status(400).json({ message: 'Capacité positive requise.' });
    if (isNaN(niv) || niv < 0) return res.status(400).json({ message: 'Niveau positif ou nul requis.' });
    if (niv > cap) return res.status(400).json({ message: 'Le niveau ne peut dépasser la capacité.' });

    const insertRes = await pool.query(`
      INSERT INTO tanks (station_id, carburant_id, capacite, niveau_actuel, date_mise_en_service)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, station_id as "stationId", carburant_id as "carburantId", capacite, niveau_actuel as "niveauActuel", date_mise_en_service as "dateMiseEnService"
    `, [stationId, Number(carburantId), cap, niv, dateMiseEnService || new Date().toISOString().slice(0, 10)]);

    const fuelRes = await pool.query('SELECT id, libelle, prix_unitaire as "prixUnitaire", couleur, seuil_minimal as "seuilMinimal" FROM fuels WHERE id = $1', [carburantId]);
    const f = fuelRes.rows[0];

    res.status(201).json({
      ...insertRes.rows[0],
      capacite: cap,
      niveauActuel: niv,
      carburant: { ...f, prixUnitaire: Number(f.prixUnitaire), seuilMinimal: Number(f.seuilMinimal) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de l’ajout de la cuve.' });
  }
});

// US 18: Modifier une cuve
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    const id = Number(req.params.id);
    const check = await pool.query('SELECT * FROM tanks WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Cuve introuvable.' });

    const current = check.rows[0];
    if (req.user.role === 'gerant' && current.station_id !== req.user.stationId) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que les cuves de votre station.' });
    }

    const { carburantId, capacite, niveauActuel } = req.body;
    const newCap = capacite !== undefined ? Number(capacite) : Number(current.capacite);
    const newNiv = niveauActuel !== undefined ? Number(niveauActuel) : Number(current.niveau_actuel);

    if (newNiv > newCap) return res.status(400).json({ message: 'Le niveau ne peut excéder la capacité.' });

    const updated = await pool.query(`
      UPDATE tanks
      SET carburant_id = COALESCE($1, carburant_id),
          capacite = $2,
          niveau_actuel = $3
      WHERE id = $4
      RETURNING id, station_id as "stationId", carburant_id as "carburantId", capacite, niveau_actuel as "niveauActuel", date_mise_en_service as "dateMiseEnService"
    `, [carburantId ? Number(carburantId) : null, newCap, newNiv, id]);

    res.json({
      ...updated.rows[0],
      capacite: newCap,
      niveauActuel: newNiv
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification de la cuve.' });
  }
});

// Supprimer une cuve
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    const id = Number(req.params.id);
    await pool.query('DELETE FROM tanks WHERE id = $1', [id]);
    res.json({ message: 'Cuve supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la cuve.' });
  }
});

export default router;
