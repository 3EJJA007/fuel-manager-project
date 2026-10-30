import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 29 & 30: Synthèse du stock
router.get('/stock-summary', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
    }

    const fuelsRes = await pool.query('SELECT * FROM fuels ORDER BY id ASC');
    let tanksQuery = 'SELECT * FROM tanks';
    const params = [];
    if (stationId) {
      tanksQuery += ' WHERE station_id = $1';
      params.push(stationId);
    }
    const tanksRes = await pool.query(tanksQuery, params);

    const summary = fuelsRes.rows.map(f => {
      const fuelTanks = tanksRes.rows.filter(t => t.carburant_id === f.id);
      const totalCapacite = fuelTanks.reduce((sum, t) => sum + Number(t.capacite || 0), 0);
      const totalNiveau = fuelTanks.reduce((sum, t) => sum + Number(t.niveau_actuel || 0), 0);
      const seuil = Number(f.seuil_minimal || 3000);
      const pourcentage = totalCapacite > 0 ? Math.round((totalNiveau / totalCapacite) * 100) : 0;

      return {
        carburantId: f.id,
        libelle: f.libelle,
        prixUnitaire: Number(f.prix_unitaire),
        couleur: f.couleur,
        seuilMinimal: seuil,
        totalCapacite: Math.round(totalCapacite),
        totalNiveau: Math.round(totalNiveau),
        pourcentage,
        estFaible: totalNiveau <= seuil,
        estCritique: totalNiveau <= (seuil * 0.5),
        nbCuves: fuelTanks.length
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la synthèse de stock.' });
  }
});

// Mouvements de stock
router.get('/movements', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
    }

    let queryText = `
      SELECT m.id, m.date_heure as "dateHeure", m.type, m.quantite, m.ancien_niveau as "ancienNiveau",
             m.nouveau_niveau as "nouveauNiveau", m.reference_id as "referenceId", m.auteur,
             f.libelle as "carburant", s.nom as "station"
      FROM stock_movements m
      JOIN fuels f ON m.carburant_id = f.id
      JOIN stations s ON m.station_id = s.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE m.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY m.date_heure DESC LIMIT 50';

    const result = await pool.query(queryText, params);
    const movements = result.rows.map(m => ({
      ...m,
      quantite: Number(m.quantite),
      ancienNiveau: Number(m.ancienNiveau),
      nouveauNiveau: Number(m.nouveauNiveau)
    }));
    res.json(movements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des mouvements de stock.' });
  }
});

// Tableau de bord
router.get('/dashboard', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
    }

    const stationsCountRes = await pool.query('SELECT COUNT(*) FROM stations');
    const activeStationsRes = await pool.query("SELECT COUNT(*) FROM stations WHERE etat = 'Active'");

    let pumpsFilter = '';
    let tanksFilter = '';
    let salesFilter = '';
    const params = [];
    if (stationId) {
      params.push(stationId);
      pumpsFilter = 'WHERE station_id = $1';
      tanksFilter = 'WHERE station_id = $1';
      salesFilter = 'AND station_id = $1';
    }

    const pumpsCountRes = await pool.query(`SELECT COUNT(*) FROM pumps ${pumpsFilter}`, params);
    const pumpsActiveRes = await pool.query(`SELECT COUNT(*) FROM pumps ${pumpsFilter ? pumpsFilter + " AND etat = 'En service'" : "WHERE etat = 'En service'"}`, params);

    const tanksRes = await pool.query(`SELECT capacite, niveau_actuel, carburant_id FROM tanks ${tanksFilter}`, params);
    const fuelsRes = await pool.query('SELECT id, seuil_minimal FROM fuels');
    const seuilMap = {};
    fuelsRes.rows.forEach(f => { seuilMap[f.id] = Number(f.seuil_minimal); });

    let totalStockVolume = 0;
    let totalCapacityVolume = 0;
    let alertsCount = 0;

    tanksRes.rows.forEach(t => {
      const cap = Number(t.capacite);
      const niv = Number(t.niveau_actuel);
      totalCapacityVolume += cap;
      totalStockVolume += niv;
      const seuil = seuilMap[t.carburant_id] || 3000;
      if (niv <= seuil) alertsCount++;
    });

    const todaysSalesRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(montant), 0) as revenue, COALESCE(SUM(quantite), 0) as liters
       FROM sales WHERE DATE(date_heure) = CURRENT_DATE ${salesFilter}`,
      params
    );

    const allSalesRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(montant), 0) as revenue
       FROM sales ${stationId ? 'WHERE station_id = $1' : ''}`,
      params
    );

    res.json({
      stationsCount: parseInt(stationsCountRes.rows[0].count, 10),
      activeStations: parseInt(activeStationsRes.rows[0].count, 10),
      pumpsCount: parseInt(pumpsCountRes.rows[0].count, 10),
      pumpsActive: parseInt(pumpsActiveRes.rows[0].count, 10),
      tanksCount: tanksRes.rows.length,
      totalStockVolume: Math.round(totalStockVolume),
      totalCapacityVolume: Math.round(totalCapacityVolume),
      globalStockPercentage: totalCapacityVolume > 0 ? Math.round((totalStockVolume / totalCapacityVolume) * 100) : 0,
      todaysSalesCount: parseInt(todaysSalesRes.rows[0].count, 10),
      todaysSalesRevenue: Number(Number(todaysSalesRes.rows[0].revenue).toFixed(3)),
      todaysLitersSold: Number(Number(todaysSalesRes.rows[0].liters).toFixed(1)),
      totalAllSalesCount: parseInt(allSalesRes.rows[0].count, 10),
      totalAllSalesRevenue: Number(Number(allSalesRes.rows[0].revenue).toFixed(3)),
      alertsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul du tableau de bord.' });
  }
});

export default router;
