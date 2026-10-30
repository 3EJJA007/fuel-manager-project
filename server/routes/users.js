import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// US 5: Liste des utilisateurs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.station_id as "stationId", u.telephone, u.date_creation as "dateCreation",
             json_build_object('id', s.id, 'nom', s.nom, 'ville', s.ville) as station
      FROM users u
      LEFT JOIN stations s ON u.station_id = s.id
      ORDER BY u.id ASC
    `);
    const users = result.rows.map(row => ({
      ...row,
      station: row.stationId ? row.station : null
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// US 5: Créer un utilisateur
router.post('/', async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, role, stationId, telephone } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Nom, e-mail et mot de passe sont requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Cet e-mail existe déjà.' });
    }

    const validRoles = ['admin', 'gerant', 'employe'];
    const chosenRole = validRoles.includes(role) ? role : 'employe';
    const hashedPassword = await bcrypt.hash(motDePasse, 10);

    const insertRes = await pool.query(`
      INSERT INTO users (nom, prenom, email, mot_de_passe, role, station_id, telephone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone, date_creation as "dateCreation"
    `, [nom.trim(), (prenom || '').trim(), cleanEmail, hashedPassword, chosenRole, stationId ? Number(stationId) : null, telephone || '']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de l’utilisateur.' });
  }
});

// US 5: Modifier le rôle ou la station
router.put('/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const check = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    if (req.user.id === targetId && req.body.role && req.body.role !== 'admin') {
      return res.status(400).json({ message: 'Vous ne pouvez pas rétrograder votre propre compte administrateur.' });
    }

    const { role, stationId, nom, prenom, telephone } = req.body;
    const current = check.rows[0];

    const updated = await pool.query(`
      UPDATE users
      SET role = COALESCE($1, role),
          station_id = $2,
          nom = COALESCE($3, nom),
          prenom = COALESCE($4, prenom),
          telephone = COALESCE($5, telephone)
      WHERE id = $6
      RETURNING id, nom, prenom, email, role, station_id as "stationId", telephone
    `, [
      role || null,
      stationId !== undefined ? (stationId ? Number(stationId) : null) : current.station_id,
      nom ? nom.trim() : null,
      prenom ? prenom.trim() : null,
      telephone ? telephone.trim() : null,
      targetId
    ]);

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification de l’utilisateur.' });
  }
});

// Supprimer un utilisateur
router.delete('/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (req.user.id === targetId) {
      return res.status(400).json({ message: 'Impossible de supprimer votre propre compte.' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
    res.json({ message: 'Utilisateur supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.' });
  }
});

export default router;
