import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Consulter les ventes
router.get('/', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  const user = req.user;

  if (user.role === 'gerant') {
    stationId = user.stationId;
  } else if (user.role === 'employe') {
    stationId = user.stationId;
  }

  let sales = stationId
    ? db.filter('sales', s => s.stationId === stationId)
    : db.collection('sales');

  // Filter by fuel if provided
  if (req.query.carburantId) {
    sales = sales.filter(s => s.carburantId === Number(req.query.carburantId));
  }

  // Filter by employee if provided
  if (req.query.employeId) {
    sales = sales.filter(s => s.employeId === Number(req.query.employeId));
  }

  // Sort by date descending
  sales.sort((a, b) => new Date(b.dateHeure) - new Date(a.dateHeure));

  // Enrich with details
  const enriched = sales.map(s => {
    const fuel = db.findById('fuels', s.carburantId);
    const pump = db.findById('pumps', s.pompeId);
    const station = db.findById('stations', s.stationId);
    const emp = db.findById('users', s.employeId);
    return {
      ...s,
      carburant: fuel ? fuel.libelle : '—',
      pompeNumero: pump ? pump.numero : (s.pompeId || '—'),
      stationNom: station ? station.nom : '—',
      employeNom: emp ? `${emp.prenom || ''} ${emp.nom}`.trim() : '—'
    };
  });

  res.json(enriched);
});

// US 26, 27, 28: Enregistrer une vente avec calcul automatique du montant et décrémentation du stock
router.post('/', (req, res) => {
  const { pompeId, carburantId, quantite, modePaiement } = req.body;

  let stationId = req.user.stationId || Number(req.body.stationId);
  if (!stationId) {
    return res.status(400).json({ message: 'Station non spécifiée ou non rattachée à votre compte.' });
  }

  const qte = Number(quantite);
  if (isNaN(qte) || qte <= 0) {
    return res.status(400).json({ message: 'La quantité doit être un nombre positif supérieur à zéro.' });
  }

  // Resolve fuel from pump or direct carburantId
  let pump = null;
  let carbId = carburantId ? Number(carburantId) : null;

  if (pompeId) {
    pump = db.findById('pumps', Number(pompeId));
    if (!pump) {
      return res.status(400).json({ message: 'Pompe introuvable.' });
    }
    if (pump.etat !== 'En service') {
      return res.status(400).json({ message: `La pompe n° ${pump.numero} est actuellement « ${pump.etat} ».` });
    }
    carbId = pump.carburantId;
  }

  const fuel = db.findById('fuels', carbId);
  if (!fuel) {
    return res.status(400).json({ message: 'Type de carburant invalide.' });
  }

  // Find corresponding tank with fuel in this station
  const targetTank = db.find('tanks', t => t.stationId === stationId && t.carburantId === fuel.id);
  if (!targetTank) {
    return res.status(400).json({ 
      message: `Aucune cuve de stockage n'existe pour « ${fuel.libelle} » dans cette station.` 
    });
  }

  // Stock check: Verify availability (sequence diagram: [stock insuffisant] -> 409)
  if (targetTank.niveauActuel < qte) {
    return res.status(409).json({
      message: `Stock insuffisant pour « ${fuel.libelle} » ! Quantité disponible dans la cuve : ${targetTank.niveauActuel.toFixed(1)} L, demandée : ${qte.toFixed(1)} L.`
    });
  }

  // US 27: Calcul automatique du montant = Quantité × Prix unitaire
  const prixUnitaire = fuel.prixUnitaire;
  const montant = Number((qte * prixUnitaire).toFixed(3));

  const ancienNiveau = targetTank.niveauActuel;
  const nouveauNiveau = Number((ancienNiveau - qte).toFixed(2));

  // 1. Decrement Tank Stock
  db.update('tanks', targetTank.id, { niveauActuel: nouveauNiveau });

  // 2. Generate receipt ID
  const salesCount = db.collection('sales').length + 1;
  const numeroRecu = `REC-${Date.now().toString().slice(-6)}-${salesCount}`;
  const now = new Date().toISOString();

  // 3. Save Sale
  const sale = db.insert('sales', {
    numeroRecu,
    stationId,
    pompeId: pump ? pump.id : null,
    cuveId: targetTank.id,
    carburantId: fuel.id,
    employeId: req.user.id,
    quantite: qte,
    prixUnitaire,
    montant,
    dateHeure: now,
    modePaiement: modePaiement || 'Espèces'
  });

  // 4. Trace stock movement
  db.insert('stock_movements', {
    dateHeure: now,
    stationId,
    cuveId: targetTank.id,
    carburantId: fuel.id,
    type: 'SORTIE_VENTE',
    quantite: qte,
    ancienNiveau,
    nouveauNiveau,
    referenceId: numeroRecu,
    auteur: `${req.user.prenom || ''} ${req.user.nom}`.trim()
  });

  // Check if stock passed below seuil
  const alerteFaible = nouveauNiveau <= (fuel.seuilMinimal || 3000);

  res.status(201).json({
    message: 'Vente enregistrée avec succès.',
    sale: {
      ...sale,
      carburant: fuel.libelle,
      pompeNumero: pump ? pump.numero : '—',
      alerteFaible
    },
    stockRestant: nouveauNiveau
  });
});

export default router;

