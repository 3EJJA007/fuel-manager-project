import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 29 & US 30: Synthèse du stock par station et par carburant
router.get('/stock-summary', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  if (req.user.role === 'gerant' || req.user.role === 'employe') {
    stationId = req.user.stationId;
  }

  const fuels = db.collection('fuels');
  const tanks = stationId 
    ? db.filter('tanks', t => t.stationId === stationId)
    : db.collection('tanks');

  const summary = fuels.map(f => {
    const fuelTanks = tanks.filter(t => t.carburantId === f.id);
    const totalCapacite = fuelTanks.reduce((sum, t) => sum + (t.capacite || 0), 0);
    const totalNiveau = fuelTanks.reduce((sum, t) => sum + (t.niveauActuel || 0), 0);
    const seuil = f.seuilMinimal || 3000;
    const pourcentage = totalCapacite > 0 ? Math.round((totalNiveau / totalCapacite) * 100) : 0;
    const estFaible = totalNiveau <= seuil;
    const estCritique = totalNiveau <= (seuil * 0.5);

    return {
      carburantId: f.id,
      libelle: f.libelle,
      prixUnitaire: f.prixUnitaire,
      couleur: f.couleur,
      seuilMinimal: seuil,
      totalCapacite,
      totalNiveau: Math.round(totalNiveau),
      pourcentage,
      estFaible,
      estCritique,
      nbCuves: fuelTanks.length,
      cuves: fuelTanks
    };
  });

  res.json(summary);
});

// Historique des mouvements de stock (entrées livraisons & sorties ventes)
router.get('/movements', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  if (req.user.role === 'gerant' || req.user.role === 'employe') {
    stationId = req.user.stationId;
  }

  let movements = stationId
    ? db.filter('stock_movements', m => m.stationId === stationId)
    : db.collection('stock_movements');

  movements.sort((a, b) => new Date(b.dateHeure) - new Date(a.dateHeure));

  const enriched = movements.slice(0, 50).map(m => {
    const fuel = db.findById('fuels', m.carburantId);
    const station = db.findById('stations', m.stationId);
    return {
      ...m,
      carburant: fuel ? fuel.libelle : '—',
      station: station ? station.nom : '—'
    };
  });

  res.json(enriched);
});

// Indicateurs clés pour le tableau de bord
router.get('/dashboard', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  if (req.user.role === 'gerant' || req.user.role === 'employe') {
    stationId = req.user.stationId;
  }

  const allStations = db.collection('stations');
  const allFuels = db.collection('fuels');
  const allPumps = stationId ? db.filter('pumps', p => p.stationId === stationId) : db.collection('pumps');
  const allTanks = stationId ? db.filter('tanks', t => t.stationId === stationId) : db.collection('tanks');
  const allSales = stationId ? db.filter('sales', s => s.stationId === stationId) : db.collection('sales');
  const allDeliveries = stationId ? db.filter('deliveries', d => d.stationId === stationId) : db.collection('deliveries');

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysSales = allSales.filter(s => (s.dateHeure || '').slice(0, 10) === todayStr);

  const totalSalesRevenueToday = todaysSales.reduce((acc, s) => acc + (s.montant || 0), 0);
  const totalLitersSoldToday = todaysSales.reduce((acc, s) => acc + (s.quantite || 0), 0);
  const totalStockVolume = allTanks.reduce((acc, t) => acc + (t.niveauActuel || 0), 0);
  const totalCapacityVolume = allTanks.reduce((acc, t) => acc + (t.capacite || 0), 0);

  // Low stock alerts count
  let alertsCount = 0;
  allTanks.forEach(t => {
    const fuel = db.findById('fuels', t.carburantId);
    const seuil = fuel ? (fuel.seuilMinimal || 3000) : 3000;
    if (t.niveauActuel <= seuil) alertsCount++;
  });

  res.json({
    stationsCount: allStations.length,
    activeStations: allStations.filter(s => s.etat === 'Active').length,
    pumpsCount: allPumps.length,
    pumpsActive: allPumps.filter(p => p.etat === 'En service').length,
    tanksCount: allTanks.length,
    totalStockVolume: Math.round(totalStockVolume),
    totalCapacityVolume: Math.round(totalCapacityVolume),
    globalStockPercentage: totalCapacityVolume > 0 ? Math.round((totalStockVolume / totalCapacityVolume) * 100) : 0,
    todaysSalesCount: todaysSales.length,
    todaysSalesRevenue: Number(totalSalesRevenueToday.toFixed(3)),
    todaysLitersSold: Number(totalLitersSoldToday.toFixed(1)),
    totalAllSalesCount: allSales.length,
    totalAllSalesRevenue: Number(allSales.reduce((acc, s) => acc + (s.montant || 0), 0).toFixed(3)),
    totalDeliveriesCount: allDeliveries.length,
    alertsCount
  });
});

export default router;

