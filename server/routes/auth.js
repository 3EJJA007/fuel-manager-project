import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      stationId: user.stationId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// US 1: S'inscrire
router.post('/register', async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Nom, e-mail et mot de passe sont obligatoires.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Format d’adresse e-mail invalide.' });
    }

    if (motDePasse.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const existing = db.find('users', u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({ message: 'Cet e-mail est déjà utilisé par un autre compte.' });
    }

    const usersCount = db.collection('users').length;
    // Premier utilisateur = admin, sinon employé par défaut
    const role = usersCount === 0 ? 'admin' : 'employe';

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const newUser = db.insert('users', {
      nom: nom.trim(),
      prenom: (prenom || '').trim(),
      email: cleanEmail,
      motDePasse: hashedPassword,
      role,
      stationId: null,
      telephone: req.body.telephone || '',
      dateCreation: new Date().toISOString()
    });

    const token = generateToken(newUser);
    const { motDePasse: _, ...safeUser } = newUser;

    return res.status(201).json({
      message: 'Inscription réussie.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Erreur interne du serveur lors de l’inscription.' });
  }
});

// US 2: S'authentifier
router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    if (!email || !motDePasse) {
      return res.status(400).json({ message: 'E-mail et mot de passe requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.find('users', u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
    }

    const validPassword = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!validPassword) {
      return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
    }

    const token = generateToken(user);
    const { motDePasse: _, ...safeUser } = user;

    // Attach station name if assigned
    let stationInfo = null;
    if (safeUser.stationId) {
      stationInfo = db.findById('stations', safeUser.stationId);
    }

    return res.json({
      message: 'Connexion réussie.',
      token,
      user: { ...safeUser, station: stationInfo }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Erreur interne lors de la connexion.' });
  }
});

// US 2 / Current user info
router.get('/me', authenticate, (req, res) => {
  const stationInfo = req.user.stationId ? db.findById('stations', req.user.stationId) : null;
  res.json({
    user: {
      ...req.user,
      station: stationInfo
    }
  });
});

// US 4: Modifier profil
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, telephone } = req.body;
    const currentUserId = req.user.id;

    const patch = {};
    if (nom) patch.nom = nom.trim();
    if (prenom !== undefined) patch.prenom = prenom.trim();
    if (telephone !== undefined) patch.telephone = telephone.trim();

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({ message: 'Format d’e-mail invalide.' });
      }
      const existing = db.find('users', u => u.email.toLowerCase() === cleanEmail && u.id !== currentUserId);
      if (existing) {
        return res.status(409).json({ message: 'Cet e-mail est déjà utilisé.' });
      }
      patch.email = cleanEmail;
    }

    if (motDePasse && motDePasse.trim().length > 0) {
      if (motDePasse.length < 6) {
        return res.status(400).json({ message: 'Le mot de passe doit comporter au moins 6 caractères.' });
      }
      patch.motDePasse = await bcrypt.hash(motDePasse, 10);
    }

    const updated = db.update('users', currentUserId, patch);
    const { motDePasse: _, ...safeUser } = updated;
    const stationInfo = safeUser.stationId ? db.findById('stations', safeUser.stationId) : null;

    res.json({
      message: 'Profil mis à jour avec succès.',
      user: { ...safeUser, station: stationInfo }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil.' });
  }
});

// Helper: Reset demo
router.post('/reset-demo', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux administrateurs.' });
  }
  db.resetToInitial();
  res.json({ message: 'Base de données réinitialisée aux données de démonstration.' });
});

export default router;

