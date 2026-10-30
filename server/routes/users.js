import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All user management routes require admin role
router.use(authenticate, requireRole('admin'));

// US 5: Liste des utilisateurs
router.get('/', (req, res) => {
  const users = db.collection('users').map(u => {
    const { motDePasse, ...safe } = u;
    const station = safe.stationId ? db.findById('stations', safe.stationId) : null;
    return { ...safe, station };
  });
  res.json(users);
});

// US 5: Créer un utilisateur manuellement par l'admin
router.post('/', async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, role, stationId, telephone } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Nom, e-mail et mot de passe sont requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (db.find('users', u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ message: 'Cet e-mail existe déjà.' });
    }

    const validRoles = ['admin', 'gerant', 'employe'];
    const chosenRole = validRoles.includes(role) ? role : 'employe';

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const user = db.insert('users', {
      nom: nom.trim(),
      prenom: (prenom || '').trim(),
      email: cleanEmail,
      motDePasse: hashedPassword,
      role: chosenRole,
      stationId: stationId ? Number(stationId) : null,
      telephone: telephone || '',
      dateCreation: new Date().toISOString()
    });

    const { motDePasse: _, ...safe } = user;
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de l’utilisateur.' });
  }
});

// US 5: Attribuer et modifier le rôle ou la station d'un utilisateur
router.put('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const user = db.findById('users', targetId);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  // Prevent admin from removing their own admin role
  if (req.user.id === targetId && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ message: 'Vous ne pouvez pas rétrograder votre propre compte administrateur.' });
  }

  const patch = {};
  if (req.body.nom) patch.nom = req.body.nom.trim();
  if (req.body.prenom !== undefined) patch.prenom = req.body.prenom.trim();
  if (req.body.telephone !== undefined) patch.telephone = req.body.telephone.trim();
  if (req.body.role && ['admin', 'gerant', 'employe'].includes(req.body.role)) {
    patch.role = req.body.role;
  }
  if (req.body.stationId !== undefined) {
    patch.stationId = req.body.stationId ? Number(req.body.stationId) : null;
  }

  const updated = db.update('users', targetId, patch);
  const { motDePasse: _, ...safe } = updated;
  const station = safe.stationId ? db.findById('stations', safe.stationId) : null;
  res.json({ ...safe, station });
});

// Supprimer un utilisateur
router.delete('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.id === targetId) {
    return res.status(400).json({ message: 'Impossible de supprimer votre propre compte.' });
  }

  const deleted = db.delete('users', targetId);
  if (!deleted) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  res.json({ message: 'Utilisateur supprimé avec succès.' });
});

export default router;

