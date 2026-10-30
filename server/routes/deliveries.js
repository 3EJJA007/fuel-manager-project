import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Consulter les livraisons (filtrées par station pour gérant, toutes pour admin)
router.get('/', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  if (req.user.role === 'gerant') {
    stationId = req.user.stationId;
  }

  let deliveries = stationId 
    ? db.filter('deliveries', d => d.stationId === stationId)
    : db.collection('deliveries');

  // Sort descending by date
  deliveries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Enrich with details
  const enriched = deliveries.map(d => {
    const supplier = db.findById('suppliers', d.fournisseurId);
    const fuel = db.findById('fuels', d.carburantId);
    const station = db.findById('stations', d.stationId);
    const tank = db.findById('tanks', d.cuveId);
    return {
      ...d,
      fournisseur: supplier ? supplier.nom : '—',
      carburant: fuel ? fuel.libelle : '—',
      carburantObj: fuel,
      station: station ? station.nom : '—',
      cuve: tank ? `Cuve #${tank.id} (${fuel?.libelle || ''})` : '—'
    };
  });

  res.json(enriched);
});

// US 24 & US 25: Enregistrer une livraison et mettre à jour le stock
router.post('/', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux gérants et administrateurs.' });
  }

  let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
  if (!stationId) {
    return res.status(400).json({ message: 'Station non affectée ou non spécifiée.' });
  }

  const { numeroBon, fournisseurId, carburantId, cuveId, quantite, prixAchat, date, notes } = req.body;

  if (!numeroBon || !fournisseurId || !carburantId || quantite === undefined) {
    return res.status(400).json({ message: 'Numéro de bon, fournisseur, carburant et quantité sont obligatoires.' });
  }

  const cleanNumBon = numeroBon.trim();
  // Check unique delivery slip
  const existingSlip = db.find('deliveries', d => d.numeroBon.toLowerCase() === cleanNumBon.toLowerCase());
  if (existingSlip) {
    return res.status(409).json({ message: `Le numéro de bon « ${cleanNumBon} » existe déjà.` });
  }

  const qte = Number(quantite);
  if (isNaN(qte) || qte <= 0) {
    return res.status(400).json({ message: 'La quantité livrée doit être un nombre positif.' });
  }

  const prix = Number(prixAchat || 0);
  if (prix < 0) {
    return res.status(400).json({ message: 'Le prix d’achat ne peut être négatif.' });
  }

  const supplier = db.findById('suppliers', Number(fournisseurId));
  if (!supplier) {
    return res.status(400).json({ message: 'Fournisseur introuvable.' });
  }

  const fuel = db.findById('fuels', Number(carburantId));
  if (!fuel) {
    return res.status(400).json({ message: 'Type de carburant introuvable.' });
  }

  // Find destination tank: either specified by ID or find tank of that station & fuel
  let targetTank = null;
  if (cuveId) {
    targetTank = db.findById('tanks', Number(cuveId));
  } else {
    targetTank = db.find('tanks', t => t.stationId === stationId && t.carburantId === fuel.id);
  }

  if (!targetTank) {
    return res.status(400).json({ 
      message: `Aucune cuve n'est configurée pour le carburant « ${fuel.libelle} » dans cette station.` 
    });
  }

  // Check capacity limit
  const spaceLeft = targetTank.capacite - targetTank.niveauActuel;
  if (qte > spaceLeft) {
    return res.status(400).json({ 
      message: `Capacité dépassée ! Espace disponible dans la cuve #${targetTank.id} : ${spaceLeft} L. Quantité livrée : ${qte} L.` 
    });
  }

  const ancienNiveau = targetTank.niveauActuel;
  const nouveauNiveau = ancienNiveau + qte;

  // 1. Update Tank level (Stock entry)
  db.update('tanks', targetTank.id, { niveauActuel: nouveauNiveau });

  // 2. Insert Delivery record
  const deliveryDate = date ? new Date(date).toISOString() : new Date().toISOString();
  const delivery = db.insert('deliveries', {
    numeroBon: cleanNumBon,
    stationId,
    cuveId: targetTank.id,
    carburantId: fuel.id,
    fournisseurId: supplier.id,
    quantite: qte,
    prixAchat: prix,
    date: deliveryDate,
    notes: notes ? notes.trim() : ''
  });

  // 3. Trace stock movement
  db.insert('stock_movements', {
    dateHeure: deliveryDate,
    stationId,
    cuveId: targetTank.id,
    carburantId: fuel.id,
    type: 'ENTREE_LIVRAISON',
    quantite: qte,
    ancienNiveau,
    nouveauNiveau,
    referenceId: cleanNumBon,
    auteur: `${req.user.prenom || ''} ${req.user.nom}`.trim()
  });

  res.status(201).json({
    message: 'Livraison enregistrée et stock mis à jour avec succès.',
    delivery,
    cuve: {
      id: targetTank.id,
      carburant: fuel.libelle,
      ancienNiveau,
      nouveauNiveau,
      capacite: targetTank.capacite
    }
  });
});

export default router;

