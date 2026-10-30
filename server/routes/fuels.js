import express from 'express';
import { db } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 12: Consulter la liste des types de carburant
router.get('/', (req, res) => {
  const fuels = db.collection('fuels');
  res.json(fuels);
});

router.get('/:id', (req, res) => {
  const fuel = db.findById('fuels', req.params.id);
  if (!fuel) {
    return res.status(404).json({ message: 'Carburant introuvable.' });
  }
  res.json(fuel);
});

// US 10: Ajouter un type de carburant (Admin)
router.post('/', requireRole('admin'), (req, res) => {
  const { libelle, prixUnitaire, seuilMinimal, description, couleur } = req.body;
  if (!libelle || prixUnitaire === undefined || prixUnitaire === '') {
    return res.status(400).json({ message: 'Le libellé et le prix unitaire sont obligatoires.' });
  }

  const cleanLibelle = libelle.trim();
  const existing = db.find('fuels', f => f.libelle.toLowerCase() === cleanLibelle.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Ce type de carburant existe déjà.' });
  }

  const prix = Number(prixUnitaire);
  if (isNaN(prix) || prix <= 0) {
    return res.status(400).json({ message: 'Le prix unitaire doit être un nombre strictement positif.' });
  }

  const seuil = seuilMinimal !== undefined && !isNaN(Number(seuilMinimal)) ? Number(seuilMinimal) : 3000;

  const newFuel = db.insert('fuels', {
    libelle: cleanLibelle,
    prixUnitaire: prix,
    seuilMinimal: seuil,
    description: description ? description.trim() : '',
    couleur: couleur || '#ff4d2e'
  });

  res.status(201).json(newFuel);
});

// US 11, US 13 & US 30: Modifier un carburant, son prix unitaire ou son seuil minimal (Admin)
router.put('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const fuel = db.findById('fuels', id);
  if (!fuel) {
    return res.status(404).json({ message: 'Carburant introuvable.' });
  }

  const patch = {};
  if (req.body.libelle) {
    const cleanLibelle = req.body.libelle.trim();
    const existing = db.find('fuels', f => f.libelle.toLowerCase() === cleanLibelle.toLowerCase() && f.id !== id);
    if (existing) {
      return res.status(409).json({ message: 'Un autre carburant porte déjà ce nom.' });
    }
    patch.libelle = cleanLibelle;
  }

  if (req.body.prixUnitaire !== undefined) {
    const prix = Number(req.body.prixUnitaire);
    if (isNaN(prix) || prix <= 0) {
      return res.status(400).json({ message: 'Le prix unitaire doit être supérieur à zéro.' });
    }
    patch.prixUnitaire = prix;
  }

  if (req.body.seuilMinimal !== undefined) {
    const seuil = Number(req.body.seuilMinimal);
    if (isNaN(seuil) || seuil < 0) {
      return res.status(400).json({ message: 'Le seuil minimal doit être un nombre positif ou nul.' });
    }
    patch.seuilMinimal = seuil;
  }

  if (req.body.description !== undefined) patch.description = req.body.description.trim();
  if (req.body.couleur) patch.couleur = req.body.couleur;

  const updated = db.update('fuels', id, patch);
  res.json(updated);
});

// Supprimer un type de carburant (Admin)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const fuel = db.findById('fuels', id);
  if (!fuel) {
    return res.status(404).json({ message: 'Carburant introuvable.' });
  }

  // Check if pumps or tanks are using it
  const usedInPumps = db.find('pumps', p => p.carburantId === id);
  const usedInTanks = db.find('tanks', t => t.carburantId === id);
  if (usedInPumps || usedInTanks) {
    return res.status(400).json({
      message: 'Impossible de supprimer ce carburant car des pompes ou des cuves y sont rattachées.'
    });
  }

  db.delete('fuels', id);
  res.json({ message: 'Carburant supprimé avec succès.' });
});

export default router;

