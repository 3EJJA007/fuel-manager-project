import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 19 & US 29: Consulter les cuves (filtrées par station pour gérant/employé, toutes pour admin)
router.get('/', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;

  if (req.user.role === 'gerant' || req.user.role === 'employe') {
    stationId = req.user.stationId;
    if (!stationId) {
      return res.status(403).json({ message: 'Vous n’êtes affecté à aucune station.' });
    }
  }

  let tanks = stationId 
    ? db.filter('tanks', t => t.stationId === stationId)
    : db.collection('tanks');

  // Enrich with fuel data, percentage and low stock flag
  const enriched = tanks.map(t => {
    const fuel = db.findById('fuels', t.carburantId);
    const station = db.findById('stations', t.stationId);
    const seuil = fuel ? (fuel.seuilMinimal || 3000) : 3000;
    const pct = t.capacite > 0 ? Math.round((t.niveauActuel / t.capacite) * 100) : 0;
    const estFaible = t.niveauActuel <= seuil;
    const estCritique = t.niveauActuel <= (seuil * 0.5);

    return {
      ...t,
      carburant: fuel,
      station: station ? { id: station.id, nom: station.nom } : null,
      pourcentage: pct,
      seuilMinimal: seuil,
      estFaible,
      estCritique
    };
  });

  res.json(enriched);
});

// US 17: Ajouter une cuve (Gérant ou Admin)
router.post('/', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
  if (!stationId) {
    return res.status(400).json({ message: 'Station requise.' });
  }

  const { carburantId, capacite, niveauActuel, dateMiseEnService } = req.body;
  if (!carburantId || capacite === undefined || capacite === '') {
    return res.status(400).json({ message: 'Type de carburant et capacité sont requis.' });
  }

  const carbId = Number(carburantId);
  const cap = Number(capacite);
  const niv = Number(niveauActuel !== undefined && niveauActuel !== '' ? niveauActuel : 0);

  if (isNaN(cap) || cap <= 0) {
    return res.status(400).json({ message: 'La capacité doit être un nombre strictement supérieur à zéro.' });
  }

  if (isNaN(niv) || niv < 0) {
    return res.status(400).json({ message: 'Le niveau initial doit être un nombre positif ou nul.' });
  }

  if (niv > cap) {
    return res.status(400).json({ message: 'Le niveau actuel ne peut pas dépasser la capacité totale de la cuve.' });
  }

  const fuel = db.findById('fuels', carbId);
  if (!fuel) {
    return res.status(400).json({ message: 'Carburant invalide.' });
  }

  const newTank = db.insert('tanks', {
    stationId,
    carburantId: carbId,
    capacite: cap,
    niveauActuel: niv,
    dateMiseEnService: dateMiseEnService || new Date().toISOString().slice(0, 10)
  });

  res.status(201).json({
    ...newTank,
    carburant: fuel
  });
});

// US 18: Modifier une cuve (Gérant ou Admin)
router.put('/:id', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  const id = Number(req.params.id);
  const tank = db.findById('tanks', id);
  if (!tank) {
    return res.status(404).json({ message: 'Cuve introuvable.' });
  }

  if (req.user.role === 'gerant' && tank.stationId !== req.user.stationId) {
    return res.status(403).json({ message: 'Vous ne pouvez modifier que les cuves de votre station.' });
  }

  const patch = {};
  if (req.body.carburantId !== undefined) {
    const carbId = Number(req.body.carburantId);
    if (!db.findById('fuels', carbId)) {
      return res.status(400).json({ message: 'Carburant introuvable.' });
    }
    patch.carburantId = carbId;
  }

  let newCap = tank.capacite;
  if (req.body.capacite !== undefined) {
    newCap = Number(req.body.capacite);
    if (isNaN(newCap) || newCap <= 0) {
      return res.status(400).json({ message: 'Capacité invalide.' });
    }
    patch.capacite = newCap;
  }

  if (req.body.niveauActuel !== undefined) {
    const newNiv = Number(req.body.niveauActuel);
    if (isNaN(newNiv) || newNiv < 0) {
      return res.status(400).json({ message: 'Niveau invalide.' });
    }
    if (newNiv > newCap) {
      return res.status(400).json({ message: 'Le niveau ne peut pas excéder la capacité de la cuve.' });
    }
    patch.niveauActuel = newNiv;
  }

  const updated = db.update('tanks', id, patch);
  const fuel = db.findById('fuels', updated.carburantId);
  res.json({ ...updated, carburant: fuel });
});

// Supprimer une cuve
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  const id = Number(req.params.id);
  const tank = db.findById('tanks', id);
  if (!tank) {
    return res.status(404).json({ message: 'Cuve introuvable.' });
  }

  if (req.user.role === 'gerant' && tank.stationId !== req.user.stationId) {
    return res.status(403).json({ message: 'Vous ne pouvez supprimer que les cuves de votre station.' });
  }

  db.delete('tanks', id);
  res.json({ message: 'Cuve supprimée avec succès.' });
});

export default router;

