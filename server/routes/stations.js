import express from 'express';
import { db } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 9: Consulter les informations des stations
router.get('/', (req, res) => {
  const stations = db.collection('stations');
  // Enhance with stats (number of pumps, tanks)
  const enriched = stations.map(s => {
    const pumps = db.filter('pumps', p => p.stationId === s.id);
    const tanks = db.filter('tanks', t => t.stationId === s.id);
    const staff = db.filter('users', u => u.stationId === s.id);
    return {
      ...s,
      nbPompes: pumps.length,
      nbCuves: tanks.length,
      nbPersonnel: staff.length
    };
  });
  res.json(enriched);
});

router.get('/:id', (req, res) => {
  const station = db.findById('stations', req.params.id);
  if (!station) {
    return res.status(404).json({ message: 'Station non trouvée.' });
  }
  const pumps = db.filter('pumps', p => p.stationId === station.id);
  const tanks = db.filter('tanks', t => t.stationId === station.id);
  res.json({ ...station, pompes: pumps, cuves: tanks });
});

// US 6: Ajouter une station (Admin)
router.post('/', requireRole('admin'), (req, res) => {
  const { nom, adresse, ville, telephone, etat } = req.body;
  if (!nom || !adresse || !ville) {
    return res.status(400).json({ message: 'Nom, adresse et ville sont obligatoires.' });
  }

  const existing = db.find('stations', s => s.nom.toLowerCase() === nom.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Une station avec ce nom existe déjà.' });
  }

  const newStation = db.insert('stations', {
    nom: nom.trim(),
    adresse: adresse.trim(),
    ville: ville.trim(),
    telephone: telephone ? telephone.trim() : '',
    etat: etat === 'Inactive' ? 'Inactive' : 'Active',
    dateCreation: new Date().toISOString()
  });

  res.status(201).json(newStation);
});

// US 7: Modifier une station (Admin)
router.put('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const station = db.findById('stations', id);
  if (!station) {
    return res.status(404).json({ message: 'Station introuvable.' });
  }

  const { nom, adresse, ville, telephone, etat } = req.body;
  const patch = {};
  if (nom) patch.nom = nom.trim();
  if (adresse) patch.adresse = adresse.trim();
  if (ville) patch.ville = ville.trim();
  if (telephone !== undefined) patch.telephone = telephone.trim();
  if (etat) patch.etat = etat;

  const updated = db.update('stations', id, patch);
  res.json(updated);
});

// US 8: Supprimer une station (Admin)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const station = db.findById('stations', id);
  if (!station) {
    return res.status(404).json({ message: 'Station introuvable.' });
  }

  // Cascade cleanup: remove pumps, tanks, and unassign users
  const pumps = db.filter('pumps', p => p.stationId === id);
  pumps.forEach(p => db.delete('pumps', p.id));

  const tanks = db.filter('tanks', t => t.stationId === id);
  tanks.forEach(t => db.delete('tanks', t.id));

  const users = db.filter('users', u => u.stationId === id);
  users.forEach(u => db.update('users', u.id, { stationId: null }));

  db.delete('stations', id);
  res.json({ message: 'Station et ses équipements associés supprimés avec succès.' });
});

export default router;

