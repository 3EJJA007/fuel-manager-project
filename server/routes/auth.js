import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, seedPostgres } from '../db.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      stationId: user.station_id || user.stationId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// US 1: S'inscrire
router.post('/register', async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, telephone } = req.body;
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

    const check = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'Cet e-mail est déjà utilisé par un autre compte.' });
    }

    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    const role = parseInt(countRes.rows[0].count, 10) === 0 ? 'admin' : 'employe';

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const insertRes = await pool.query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, station_id, telephone)
       VALUES ($1, $2, $3, $4, $5, NULL, $6)
       RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone, date_creation as "dateCreation"`,
      [nom.trim(), (prenom || '').trim(), cleanEmail, hashedPassword, role, telephone || '']
    );

    const newUser = insertRes.rows[0];
    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Inscription réussie.',
      token,
      user: { ...newUser, station: null }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Erreur interne lors de l’inscription.' });
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
    const result = await pool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.mot_de_passe, u.role, u.station_id as "stationId", u.telephone,
              s.nom as "stationNom", s.ville as "stationVille"
       FROM users u
       LEFT JOIN stations s ON u.station_id = s.id
       WHERE LOWER(u.email) = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(motDePasse, user.mot_de_passe);
    if (!validPassword) {
      return res.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      stationId: user.stationId,
      telephone: user.telephone,
      station: user.stationId ? { id: user.stationId, nom: user.stationNom, ville: user.stationVille } : null
    };

    return res.json({
      message: 'Connexion réussie.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Erreur interne lors de la connexion.' });
  }
});

// Current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// US 4: Modifier profil
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, telephone } = req.body;
    const currentUserId = req.user.id;

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2', [cleanEmail, currentUserId]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'Cet e-mail est déjà utilisé par un autre compte.' });
      }
    }

    let passwordClause = '';
    const params = [nom.trim(), (prenom || '').trim(), (telephone || '').trim(), currentUserId];

    if (email) {
      params.splice(2, 0, email.trim().toLowerCase());
    }

    let queryText = '';
    if (motDePasse && motDePasse.length >= 6) {
      const hashed = await bcrypt.hash(motDePasse, 10);
      if (email) {
        queryText = `UPDATE users SET nom=$1, prenom=$2, email=$3, telephone=$4, mot_de_passe=$5 WHERE id=$6 RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone`;
        params.splice(4, 0, hashed);
      } else {
        queryText = `UPDATE users SET nom=$1, prenom=$2, telephone=$3, mot_de_passe=$4 WHERE id=$5 RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone`;
        params.splice(3, 0, hashed);
      }
    } else {
      if (email) {
        queryText = `UPDATE users SET nom=$1, prenom=$2, email=$3, telephone=$4 WHERE id=$5 RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone`;
      } else {
        queryText = `UPDATE users SET nom=$1, prenom=$2, telephone=$3 WHERE id=$4 RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone`;
      }
    }

    const updated = await pool.query(queryText, params);
    const row = updated.rows[0];

    let stationInfo = null;
    if (row.stationId) {
      const st = await pool.query('SELECT id, nom, ville FROM stations WHERE id=$1', [row.stationId]);
      stationInfo = st.rows[0] || null;
    }

    res.json({
      message: 'Profil mis à jour avec succès.',
      user: { ...row, station: stationInfo }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil.' });
  }
});

// Helper: Reset demo
router.post('/reset-demo', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux administrateurs.' });
  }
  const client = await pool.connect();
  try {
    await seedPostgres(client);
    res.json({ message: 'Base PostgreSQL réinitialisée aux données de démonstration.' });
  } finally {
    client.release();
  }
});

export default router;
