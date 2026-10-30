import express from 'express';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 9: Consulter les informations des stations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.nom, s.adresse, s.ville, s.telephone, s.etat, s.date_creation as "dateCreation",
             (SELECT COUNT(*) FROM pumps p WHERE p.station_id = s.id) as "nbPompes",
             (SELECT COUNT(*) FROM tanks t WHERE t.station_id = s.id) as "nbCuves",
             (SELECT COUNT(*) FROM users u WHERE u.station_id = s.id) as "nbPersonnel"
      FROM stations s
      ORDER BY s.id ASC
    `);
    const stations = result.rows.map(r => ({
      ...r,
      nbPompes: parseInt(r.nbPompes, 10),
      nbCuves: parseInt(r.nbCuves, 10),
      nbPersonnel: parseInt(r.nbPersonnel, 10)
    }));
    res.json(stations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des stations.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stationRes = await pool.query('SELECT * FROM stations WHERE id = $1', [id]);
    if (stationRes.rows.length === 0) {
      return res.status(404).json({ message: 'Station non trouvée.' });
    }
    const pumpsRes = await pool.query('SELECT * FROM pumps WHERE station_id = $1', [id]);
    const tanksRes = await pool.query('SELECT * FROM tanks WHERE station_id = $1', [id]);
    res.json({ ...stationRes.rows[0], pompes: pumpsRes.rows, cuves: tanksRes.rows });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// US 6: Ajouter une station
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { nom, adresse, ville, telephone, etat } = req.body;
    if (!nom || !adresse || !ville) {
      return res.status(400).json({ message: 'Nom, adresse et ville sont obligatoires.' });
    }

    const check = await pool.query('SELECT id FROM stations WHERE LOWER(nom) = $1', [nom.trim().toLowerCase()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'Une station avec ce nom existe déjà.' });
    }

    const insertRes = await pool.query(`
      INSERT INTO stations (nom, adresse, ville, telephone, etat)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nom, adresse, ville, telephone, etat, date_creation as "dateCreation"
    `, [nom.trim(), adresse.trim(), ville.trim(), (telephone || '').trim(), etat === 'Inactive' ? 'Inactive' : 'Active']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de la station.' });
  }
});

// US 7: Modifier une station
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nom, adresse, ville, telephone, etat } = req.body;

    const updated = await pool.query(`
      UPDATE stations
      SET nom = COALESCE($1, nom),
          adresse = COALESCE($2, adresse),
          ville = COALESCE($3, ville),
          telephone = COALESCE($4, telephone),
          etat = COALESCE($5, etat)
      WHERE id = $6
      RETURNING id, nom, adresse, ville, telephone, etat, date_creation as "dateCreation"
    `, [
      nom ? nom.trim() : null,
      adresse ? adresse.trim() : null,
      ville ? ville.trim() : null,
      telephone !== undefined ? telephone.trim() : null,
      etat || null,
      id
    ]);

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Station introuvable.' });
    }
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

// US 8: Supprimer une station
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await pool.query('DELETE FROM stations WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      return res.status(404).json({ message: 'Station introuvable.' });
    }
    res.json({ message: 'Station et ses équipements associés supprimés avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la station.' });
  }
});

export default router;
