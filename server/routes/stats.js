import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/stock-summary', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    if (isRestricted && !stationId) {
      return res.json([]);
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
        estFaible: totalCapacite > 0 && totalNiveau <= seuil,
        estCritique: totalCapacite > 0 && totalNiveau <= (seuil * 0.5),
        nbCuves: fuelTanks.length
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la synthèse de stock.' });
  }
});

router.get('/movements', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    if (isRestricted && !stationId) {
      return res.json([]);
    }

    let queryText = `
      SELECT m.id, m.date_heure as "dateHeure", m.type, m.quantite, m.ancien_niveau as "ancienNiveau",
             m.nouveau_niveau as "nouveauNiveau", m.reference_id as "referenceId", m.auteur,
             m.station_id as "stationId", m.carburant_id as "carburantId",
             f.libelle as "carburant", s.nom as "station"
      FROM stock_movements m
      JOIN fuels f ON m.carburant_id = f.id
      JOIN stations s ON m.station_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (stationId) {
      params.push(stationId);
      conditions.push(`m.station_id = $${params.length}`);
    }

    if (req.query.type) {
      params.push(req.query.type);
      conditions.push(`m.type = $${params.length}`);
    }

    if (req.query.carburantId) {
      params.push(Number(req.query.carburantId));
      conditions.push(`m.carburant_id = $${params.length}`);
    }

    if (req.query.dateDebut) {
      params.push(req.query.dateDebut);
      conditions.push(`DATE(m.date_heure) >= $${params.length}`);
    }

    if (req.query.dateFin) {
      params.push(req.query.dateFin);
      conditions.push(`DATE(m.date_heure) <= $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY m.date_heure DESC LIMIT 100';

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

router.get('/dashboard', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    if (isRestricted && !stationId) {
      return res.json({
        hasStation: false,
        stationsCount: 0,
        activeStations: 0,
        pumpsCount: 0,
        pumpsActive: 0,
        tanksCount: 0,
        totalStockVolume: 0,
        totalCapacityVolume: 0,
        globalStockPercentage: 0,
        stockEssence: 0,
        stockGasoil: 0,
        approvisionnementsVolume: 0,
        approvisionnementsCount: 0,
        todaysSalesCount: 0,
        todaysSalesRevenue: 0,
        todaysLitersSold: 0,
        totalAllSalesCount: 0,
        totalAllSalesRevenue: 0,
        alertsCount: 0,
        stationsEnAlerte: []
      });
    }

    const stationsCountRes = await pool.query('SELECT COUNT(*) FROM stations');
    const activeStationsRes = await pool.query("SELECT COUNT(*) FROM stations WHERE etat = 'Active'");

    let pumpsFilter = '';
    let tanksFilter = '';
    let salesFilter = '';
    let delivFilter = '';
    const params = [];
    if (stationId) {
      params.push(stationId);
      pumpsFilter = 'WHERE station_id = $1';
      tanksFilter = 'WHERE t.station_id = $1';
      salesFilter = 'AND station_id = $1';
      delivFilter = 'WHERE station_id = $1';
    }

    const pumpsCountRes = await pool.query(`SELECT COUNT(*) FROM pumps ${pumpsFilter}`, params);
    const pumpsActiveRes = await pool.query(`SELECT COUNT(*) FROM pumps ${pumpsFilter ? pumpsFilter + " AND etat = 'En service'" : "WHERE etat = 'En service'"}`, params);

    const tanksRes = await pool.query(`
      SELECT t.id, t.capacite, t.niveau_actuel, t.carburant_id, t.station_id,
             f.libelle, f.seuil_minimal, s.nom as "stationNom"
      FROM tanks t
      JOIN fuels f ON t.carburant_id = f.id
      JOIN stations s ON t.station_id = s.id
      ${tanksFilter}
    `, params);

    let totalStockVolume = 0;
    let totalCapacityVolume = 0;
    let stockEssence = 0;
    let stockGasoil = 0;
    let alertsCount = 0;
    const stationsEnAlerteMap = {};

    tanksRes.rows.forEach(t => {
      const cap = Number(t.capacite);
      const niv = Number(t.niveau_actuel);
      const seuil = Number(t.seuil_minimal || 3000);
      totalCapacityVolume += cap;
      totalStockVolume += niv;

      const libelleLower = (t.libelle || '').toLowerCase();
      if (libelleLower.includes('plomb') || libelleLower.includes('essence')) {
        stockEssence += niv;
      } else {
        stockGasoil += niv;
      }

      if (cap > 0 && niv <= seuil) {
        alertsCount++;
        if (!stationsEnAlerteMap[t.station_id]) {
          stationsEnAlerteMap[t.station_id] = {
            id: t.station_id,
            nom: t.stationNom,
            cuves: []
          };
        }
        stationsEnAlerteMap[t.station_id].cuves.push({
          id: t.id,
          carburant: t.libelle,
          niveau: niv,
          seuil
        });
      }
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

    const deliveriesRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(quantite), 0) as volume
       FROM deliveries ${delivFilter}`,
      params
    );

    res.json({
      hasStation: true,
      stationsCount: parseInt(stationsCountRes.rows[0].count, 10),
      activeStations: parseInt(activeStationsRes.rows[0].count, 10),
      pumpsCount: parseInt(pumpsCountRes.rows[0].count, 10),
      pumpsActive: parseInt(pumpsActiveRes.rows[0].count, 10),
      tanksCount: tanksRes.rows.length,
      totalStockVolume: Math.round(totalStockVolume),
      totalCapacityVolume: Math.round(totalCapacityVolume),
      globalStockPercentage: totalCapacityVolume > 0 ? Math.round((totalStockVolume / totalCapacityVolume) * 100) : 0,
      stockEssence: Math.round(stockEssence),
      stockGasoil: Math.round(stockGasoil),
      approvisionnementsVolume: Math.round(Number(deliveriesRes.rows[0].volume)),
      approvisionnementsCount: parseInt(deliveriesRes.rows[0].count, 10),
      todaysSalesCount: parseInt(todaysSalesRes.rows[0].count, 10),
      todaysSalesRevenue: Number(Number(todaysSalesRes.rows[0].revenue).toFixed(3)),
      todaysLitersSold: Number(Number(todaysSalesRes.rows[0].liters).toFixed(1)),
      totalAllSalesCount: parseInt(allSalesRes.rows[0].count, 10),
      totalAllSalesRevenue: Number(Number(allSalesRes.rows[0].revenue).toFixed(3)),
      alertsCount,
      stationsEnAlerte: Object.values(stationsEnAlerteMap)
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Erreur lors du calcul du tableau de bord.' });
  }
});

router.get('/daily-sales', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    const days = Math.min(Number(req.query.days) || 7, 30);
    const params = [days];
    let stationClause = '';
    if (stationId) {
      params.push(stationId);
      stationClause = 'AND station_id = $2';
    }

    const result = await pool.query(`
      SELECT TO_CHAR(d.day, 'YYYY-MM-DD') as date_str,
             TO_CHAR(d.day, 'DD/MM') as label,
             COALESCE(SUM(s.montant), 0) as revenue,
             COALESCE(SUM(s.quantite), 0) as volume,
             COUNT(s.id) as count
      FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day'::interval) d(day)
      LEFT JOIN sales s ON DATE(s.date_heure) = DATE(d.day) ${stationClause}
      GROUP BY d.day
      ORDER BY d.day ASC
    `, params);

    res.json(result.rows.map(r => ({
      date: r.date_str,
      label: r.label,
      revenue: Number(Number(r.revenue).toFixed(3)),
      volume: Number(Number(r.volume).toFixed(1)),
      count: parseInt(r.count, 10)
    })));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques journalières.' });
  }
});

router.get('/sales-by-fuel', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    const params = [];
    let whereClause = '';
    if (stationId) {
      params.push(stationId);
      whereClause = 'WHERE s.station_id = $1';
    }

    const result = await pool.query(`
      SELECT f.id, f.libelle, f.couleur,
             COALESCE(SUM(s.quantite), 0) as volume,
             COALESCE(SUM(s.montant), 0) as revenue,
             COUNT(s.id) as count
      FROM fuels f
      LEFT JOIN sales s ON s.carburant_id = f.id ${whereClause}
      GROUP BY f.id, f.libelle, f.couleur
      ORDER BY revenue DESC
    `, params);

    const totalRev = result.rows.reduce((sum, r) => sum + Number(r.revenue), 0);
    res.json(result.rows.map(r => {
      const rev = Number(Number(r.revenue).toFixed(3));
      return {
        id: r.id,
        libelle: r.libelle,
        couleur: r.couleur,
        volume: Number(Number(r.volume).toFixed(1)),
        revenue: rev,
        count: parseInt(r.count, 10),
        pourcentage: totalRev > 0 ? Math.round((rev / totalRev) * 100) : 0
      };
    }));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des ventes par carburant.' });
  }
});

export default router;
