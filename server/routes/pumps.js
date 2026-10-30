import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 16: Consulter les pompes
router.get('/', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
      if (!stationId) return res.status(403).json({ message: 'Vous n’êtes affecté à aucune station.' });
    }

    let queryText = `
      SELECT p.id, p.station_id as "stationId", p.numero, p.carburant_id as "carburantId", p.etat, p.description,
             json_build_object('id', f.id, 'libelle', f.libelle, 'prixUnitaire', f.prix_unitaire, 'couleur', f.couleur) as carburant,
             json_build_object('id', s.id, 'nom', s.nom) as station
      FROM pumps p
      JOIN fuels f ON p.carburant_id = f.id
      JOIN stations s ON p.station_id = s.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE p.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY p.station_id ASC, p.numero ASC';

    const result = await pool.query(queryText, params);
    const pumps = result.rows.map(p => ({
      ...p,
      carburant: {
        ...p.carburant,
        prixUnitaire: Number(p.carburant.prixUnitaire)
      }
    }));
    res.json(pumps);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des pompes.' });
  }
});

// US 14: Ajouter une pompe
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
    if (!stationId) return res.status(400).json({ message: 'Station non spécifiée.' });

    const { numero, carburantId, etat, description } = req.body;
    if (!numero || !carburantId) return res.status(400).json({ message: 'Numéro et carburant sont requis.' });

    const num = Number(numero);
    const carbId = Number(carburantId);

    const check = await pool.query('SELECT id FROM pumps WHERE station_id = $1 AND numero = $2', [stationId, num]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: `La pompe n° ${num} existe déjà pour cette station.` });
    }

    const insertRes = await pool.query(`
      INSERT INTO pumps (station_id, numero, carburant_id, etat, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, station_id as "stationId", numero, carburant_id as "carburantId", etat, description
    `, [stationId, num, carbId, etat || 'En service', description ? description.trim() : `Pompe ${num}`]);

    const fuelRes = await pool.query('SELECT id, libelle, prix_unitaire as "prixUnitaire", couleur FROM fuels WHERE id = $1', [carbId]);
    const f = fuelRes.rows[0];

    res.status(201).json({
      ...insertRes.rows[0],
      carburant: { ...f, prixUnitaire: Number(f.prixUnitaire) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de l’ajout de la pompe.' });
  }
});

// US 15: Modifier une pompe
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    const id = Number(req.params.id);
    const check = await pool.query('SELECT * FROM pumps WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Pompe introuvable.' });

    const current = check.rows[0];
    if (req.user.role === 'gerant' && current.station_id !== req.user.stationId) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que les pompes de votre station.' });
    }

    const { numero, carburantId, etat, description } = req.body;
    const updated = await pool.query(`
      UPDATE pumps
      SET numero = COALESCE($1, numero),
          carburant_id = COALESCE($2, carburant_id),
          etat = COALESCE($3, etat),
          description = COALESCE($4, description)
      WHERE id = $5
      RETURNING id, station_id as "stationId", numero, carburant_id as "carburantId", etat, description
    `, [
      numero !== undefined ? Number(numero) : null,
      carburantId !== undefined ? Number(carburantId) : null,
      etat || null,
      description !== undefined ? description.trim() : null,
      id
    ]);

    const pump = updated.rows[0];
    const fuelRes = await pool.query('SELECT id, libelle, prix_unitaire as "prixUnitaire", couleur FROM fuels WHERE id = $1', [pump.carburantId]);
    const f = fuelRes.rows[0];

    res.json({
      ...pump,
      carburant: { ...f, prixUnitaire: Number(f.prixUnitaire) }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification de la pompe.' });
  }
});

// Supprimer une pompe
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Action non autorisée.' });
    }

    const id = Number(req.params.id);
    const check = await pool.query('SELECT station_id FROM pumps WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Pompe introuvable.' });

    if (req.user.role === 'gerant' && check.rows[0].station_id !== req.user.stationId) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que les pompes de votre station.' });
    }

    await pool.query('DELETE FROM pumps WHERE id = $1', [id]);
    res.json({ message: 'Pompe supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la pompe.' });
  }
});

export default router;
