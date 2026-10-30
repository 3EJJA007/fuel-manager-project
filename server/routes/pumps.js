import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 16: Consulter les pompes (filtrées par station pour gérant/employé, toutes pour admin)
router.get('/', (req, res) => {
  let stationId = req.query.stationId ? Number(req.query.stationId) : null;
  
  if (req.user.role === 'gerant' || req.user.role === 'employe') {
    stationId = req.user.stationId;
    if (!stationId) {
      return res.status(403).json({ message: 'Vous n’êtes affecté à aucune station.' });
    }
  }

  let pumps = stationId 
    ? db.filter('pumps', p => p.stationId === stationId)
    : db.collection('pumps');

  // Enrich with fuel and station info
  const enriched = pumps.map(p => {
    const fuel = db.findById('fuels', p.carburantId);
    const station = db.findById('stations', p.stationId);
    return {
      ...p,
      carburant: fuel,
      station: station ? { id: station.id, nom: station.nom } : null
    };
  });

  res.json(enriched);
});

// US 14: Ajouter une pompe (Gérant de station ou Admin)
router.post('/', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Seuls les gérants et administrateurs peuvent ajouter une pompe.' });
  }

  let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
  if (!stationId) {
    return res.status(400).json({ message: 'Station non spécifiée ou non affectée au gérant.' });
  }

  const { numero, carburantId, etat, description } = req.body;
  if (!numero || !carburantId) {
    return res.status(400).json({ message: 'Numéro de pompe et carburant sont requis.' });
  }

  const num = Number(numero);
  const carbId = Number(carburantId);

  // Validate fuel exists
  const fuel = db.findById('fuels', carbId);
  if (!fuel) {
    return res.status(400).json({ message: 'Type de carburant invalide.' });
  }

  // Check unique pump number in this station
  const existing = db.find('pumps', p => p.stationId === stationId && p.numero === num);
  if (existing) {
    return res.status(409).json({ message: `La pompe n° ${num} existe déjà pour cette station.` });
  }

  const validEtats = ['En service', 'Hors service', 'Maintenance'];
  const newPump = db.insert('pumps', {
    stationId,
    numero: num,
    carburantId: carbId,
    etat: validEtats.includes(etat) ? etat : 'En service',
    description: description ? description.trim() : `Pompe ${num}`
  });

  res.status(201).json({
    ...newPump,
    carburant: fuel
  });
});

// US 15: Modifier une pompe (Gérant ou Admin)
router.put('/:id', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  const id = Number(req.params.id);
  const pump = db.findById('pumps', id);
  if (!pump) {
    return res.status(404).json({ message: 'Pompe introuvable.' });
  }

  if (req.user.role === 'gerant' && pump.stationId !== req.user.stationId) {
    return res.status(403).json({ message: 'Vous ne pouvez modifier que les pompes de votre station.' });
  }

  const patch = {};
  if (req.body.numero !== undefined) {
    const num = Number(req.body.numero);
    const existing = db.find('pumps', p => p.stationId === pump.stationId && p.numero === num && p.id !== id);
    if (existing) {
      return res.status(409).json({ message: `Le numéro de pompe ${num} est déjà utilisé dans cette station.` });
    }
    patch.numero = num;
  }

  if (req.body.carburantId !== undefined) {
    const carbId = Number(req.body.carburantId);
    if (!db.findById('fuels', carbId)) {
      return res.status(400).json({ message: 'Carburant invalide.' });
    }
    patch.carburantId = carbId;
  }

  if (req.body.etat && ['En service', 'Hors service', 'Maintenance'].includes(req.body.etat)) {
    patch.etat = req.body.etat;
  }

  if (req.body.description !== undefined) {
    patch.description = req.body.description.trim();
  }

  const updated = db.update('pumps', id, patch);
  const fuel = db.findById('fuels', updated.carburantId);
  res.json({ ...updated, carburant: fuel });
});

// Supprimer une pompe
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action non autorisée.' });
  }

  const id = Number(req.params.id);
  const pump = db.findById('pumps', id);
  if (!pump) {
    return res.status(404).json({ message: 'Pompe introuvable.' });
  }

  if (req.user.role === 'gerant' && pump.stationId !== req.user.stationId) {
    return res.status(403).json({ message: 'Vous ne pouvez supprimer que les pompes de votre station.' });
  }

  db.delete('pumps', id);
  res.json({ message: 'Pompe supprimée avec succès.' });
});

export default router;

