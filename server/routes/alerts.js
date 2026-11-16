import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isGerant = req.user.role === 'gerant';
    const stationId = isGerant ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    if (isGerant && !stationId) {
      return res.json([]);
    }

    let queryText = `
      SELECT a.id, a.quantite_restante as "quantiteRestante", a.seuil_minimal as "seuilMinimal",
             a.date_heure as "dateHeure", a.traitee, a.station_id as "stationId",
             a.cuve_id as "cuveId", a.carburant_id as "carburantId",
             s.nom as "stationNom", f.libelle as "carburantLibelle", f.couleur as "carburantCouleur"
      FROM alerts a
      JOIN stations s ON a.station_id = s.id
      JOIN fuels f ON a.carburant_id = f.id
    `;
    const params = [];
    const conditions = [];

    if (stationId) {
      params.push(stationId);
      conditions.push(`a.station_id = $${params.length}`);
    }

    if (req.query.traitee !== undefined) {
      params.push(req.query.traitee === 'true');
      conditions.push(`a.traitee = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY a.traitee ASC, a.date_heure DESC';

    const result = await pool.query(queryText, params);
    res.json(result.rows.map(r => ({
      ...r,
      quantiteRestante: Number(r.quantiteRestante),
      seuilMinimal: Number(r.seuilMinimal)
    })));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des alertes.' });
  }
});

router.put('/:id/traiter', async (req, res) => {
  try {
    const alertId = Number(req.params.id);
    const isGerant = req.user.role === 'gerant';

    const check = await pool.query('SELECT * FROM alerts WHERE id = $1', [alertId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Alerte introuvable.' });
    }

    if (isGerant && check.rows[0].station_id !== req.user.stationId) {
      return res.status(403).json({ message: 'Action non autorisée sur une autre station.' });
    }

    await pool.query('UPDATE alerts SET traitee = true WHERE id = $1', [alertId]);

    await pool.query(`
      INSERT INTO notifications (user_id, message, type, alerte_id)
      VALUES ($1, $2, 'info', $3)
    `, [req.user.id, `Alerte #${alertId} marquée comme traitée par ${req.user.prenom || ''} ${req.user.nom}.`, alertId]);

    res.json({ message: 'Alerte marquée comme traitée avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du traitement de l’alerte.' });
  }
});

router.get('/low-stock-stations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT s.id, s.nom, s.ville, s.telephone,
             f.libelle as "carburant", t.niveau_actuel as "niveauActuel",
             f.seuil_minimal as "seuilMinimal"
      FROM tanks t
      JOIN stations s ON t.station_id = s.id
      JOIN fuels f ON t.carburant_id = f.id
      WHERE t.niveau_actuel <= f.seuil_minimal
      ORDER BY s.nom ASC
    `);

    const stationsMap = {};
    result.rows.forEach(r => {
      if (!stationsMap[r.id]) {
        stationsMap[r.id] = {
          id: r.id,
          nom: r.nom,
          ville: r.ville,
          telephone: r.telephone,
          cuvesFaibles: []
        };
      }
      stationsMap[r.id].cuvesFaibles.push({
        carburant: r.carburant,
        niveauActuel: Number(r.niveauActuel),
        seuilMinimal: Number(r.seuilMinimal)
      });
    });

    res.json(Object.values(stationsMap));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des stations en stock faible.' });
  }
});

export default router;
