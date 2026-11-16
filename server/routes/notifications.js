import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, message, type, date_creation as "dateCreation", lue, alerte_id as "alerteId"
      FROM notifications
      WHERE user_id = $1
      ORDER BY lue ASC, date_creation DESC
      LIMIT 30
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications.' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notifId = Number(req.params.id);
    await pool.query('UPDATE notifications SET lue = true WHERE id = $1 AND user_id = $2', [notifId, req.user.id]);
    res.json({ message: 'Notification marquée comme lue.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la notification.' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET lue = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Toutes les notifications ont été marquées comme lues.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour des notifications.' });
  }
});

export default router;
