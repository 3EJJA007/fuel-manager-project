import express from 'express';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 12: Consulter la liste des types de carburant
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, libelle, prix_unitaire as "prixUnitaire", seuil_minimal as "seuilMinimal", description, couleur
      FROM fuels
      ORDER BY id ASC
    `);
    const fuels = result.rows.map(f => ({
      ...f,
      prixUnitaire: Number(f.prixUnitaire),
      seuilMinimal: Number(f.seuilMinimal)
    }));
    res.json(fuels);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des carburants.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, libelle, prix_unitaire as "prixUnitaire", seuil_minimal as "seuilMinimal", description, couleur FROM fuels WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Carburant introuvable.' });
    const f = result.rows[0];
    res.json({ ...f, prixUnitaire: Number(f.prixUnitaire), seuilMinimal: Number(f.seuilMinimal) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// US 10: Ajouter un carburant
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { libelle, prixUnitaire, seuilMinimal, description, couleur } = req.body;
    if (!libelle || prixUnitaire === undefined || prixUnitaire === '') {
      return res.status(400).json({ message: 'Le libellé et le prix unitaire sont obligatoires.' });
    }

    const check = await pool.query('SELECT id FROM fuels WHERE LOWER(libelle) = $1', [libelle.trim().toLowerCase()]);
    if (check.rows.length > 0) return res.status(409).json({ message: 'Ce type de carburant existe déjà.' });

    const prix = Number(prixUnitaire);
    if (isNaN(prix) || prix <= 0) return res.status(400).json({ message: 'Prix unitaire invalide.' });

    const insertRes = await pool.query(`
      INSERT INTO fuels (libelle, prix_unitaire, seuil_minimal, description, couleur)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, libelle, prix_unitaire as "prixUnitaire", seuil_minimal as "seuilMinimal", description, couleur
    `, [libelle.trim(), prix, Number(seuilMinimal) || 3000, description ? description.trim() : '', couleur || '#ff4d2e']);

    const f = insertRes.rows[0];
    res.status(201).json({ ...f, prixUnitaire: Number(f.prixUnitaire), seuilMinimal: Number(f.seuilMinimal) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de l’ajout du carburant.' });
  }
});

// US 11, 13 & 30: Modifier carburant, prix unitaire, seuil minimal
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { libelle, prixUnitaire, seuilMinimal, description, couleur } = req.body;

    const updated = await pool.query(`
      UPDATE fuels
      SET libelle = COALESCE($1, libelle),
          prix_unitaire = COALESCE($2, prix_unitaire),
          seuil_minimal = COALESCE($3, seuil_minimal),
          description = COALESCE($4, description),
          couleur = COALESCE($5, couleur)
      WHERE id = $6
      RETURNING id, libelle, prix_unitaire as "prixUnitaire", seuil_minimal as "seuilMinimal", description, couleur
    `, [
      libelle ? libelle.trim() : null,
      prixUnitaire !== undefined ? Number(prixUnitaire) : null,
      seuilMinimal !== undefined ? Number(seuilMinimal) : null,
      description !== undefined ? description.trim() : null,
      couleur || null,
      id
    ]);

    if (updated.rows.length === 0) return res.status(404).json({ message: 'Carburant introuvable.' });
    const f = updated.rows[0];
    res.json({ ...f, prixUnitaire: Number(f.prixUnitaire), seuilMinimal: Number(f.seuilMinimal) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification du carburant.' });
  }
});

// Supprimer un type de carburant
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const checkPumps = await pool.query('SELECT 1 FROM pumps WHERE carburant_id = $1 LIMIT 1', [id]);
    const checkTanks = await pool.query('SELECT 1 FROM tanks WHERE carburant_id = $1 LIMIT 1', [id]);
    if (checkPumps.rows.length > 0 || checkTanks.rows.length > 0) {
      return res.status(400).json({ message: 'Impossible de supprimer ce carburant : des pompes ou cuves y sont associées.' });
    }

    await pool.query('DELETE FROM fuels WHERE id = $1', [id]);
    res.json({ message: 'Carburant supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression du carburant.' });
  }
});

export default router;
