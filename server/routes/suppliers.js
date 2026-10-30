import express from 'express';
import { db } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// US 23: Consulter la liste des fournisseurs (Admin et Gérant)
router.get('/', (req, res) => {
  const suppliers = db.collection('suppliers');
  res.json(suppliers);
});

router.get('/:id', (req, res) => {
  const supplier = db.findById('suppliers', req.params.id);
  if (!supplier) {
    return res.status(404).json({ message: 'Fournisseur non trouvé.' });
  }
  res.json(supplier);
});

// US 20: Ajouter un fournisseur (Admin)
router.post('/', requireRole('admin'), (req, res) => {
  const { nom, telephone, email, adresse, matriculeFiscale } = req.body;
  if (!nom) {
    return res.status(400).json({ message: 'Le nom du fournisseur est obligatoire.' });
  }

  const cleanNom = nom.trim();
  const existing = db.find('suppliers', s => s.nom.toLowerCase() === cleanNom.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Ce fournisseur existe déjà.' });
  }

  const newSupplier = db.insert('suppliers', {
    nom: cleanNom,
    telephone: telephone ? telephone.trim() : '',
    email: email ? email.trim() : '',
    adresse: adresse ? adresse.trim() : '',
    matriculeFiscale: matriculeFiscale ? matriculeFiscale.trim() : ''
  });

  res.status(201).json(newSupplier);
});

// US 21: Modifier un fournisseur (Admin)
router.put('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const supplier = db.findById('suppliers', id);
  if (!supplier) {
    return res.status(404).json({ message: 'Fournisseur introuvable.' });
  }

  const patch = {};
  if (req.body.nom) {
    const cleanNom = req.body.nom.trim();
    const existing = db.find('suppliers', s => s.nom.toLowerCase() === cleanNom.toLowerCase() && s.id !== id);
    if (existing) {
      return res.status(409).json({ message: 'Un autre fournisseur porte déjà ce nom.' });
    }
    patch.nom = cleanNom;
  }

  if (req.body.telephone !== undefined) patch.telephone = req.body.telephone.trim();
  if (req.body.email !== undefined) patch.email = req.body.email.trim();
  if (req.body.adresse !== undefined) patch.adresse = req.body.adresse.trim();
  if (req.body.matriculeFiscale !== undefined) patch.matriculeFiscale = req.body.matriculeFiscale.trim();

  const updated = db.update('suppliers', id, patch);
  res.json(updated);
});

// US 22: Supprimer un fournisseur (Admin)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const supplier = db.findById('suppliers', id);
  if (!supplier) {
    return res.status(404).json({ message: 'Fournisseur introuvable.' });
  }

  // Check if deliveries reference this supplier
  const used = db.find('deliveries', d => d.fournisseurId === id);
  if (used) {
    return res.status(400).json({
      message: 'Impossible de supprimer ce fournisseur car des livraisons y sont associées.'
    });
  }

  db.delete('suppliers', id);
  res.json({ message: 'Fournisseur supprimé avec succès.' });
});

export default router;

