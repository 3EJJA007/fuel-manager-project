import express from 'express';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// US 23: Consulter les fournisseurs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, telephone, email, adresse, matricule_fiscale as "matriculeFiscale"
      FROM suppliers
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des fournisseurs.' });
  }
});

// US 20: Ajouter un fournisseur
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { nom, telephone, email, adresse, matriculeFiscale } = req.body;
    if (!nom) return res.status(400).json({ message: 'Le nom du fournisseur est obligatoire.' });

    const check = await pool.query('SELECT id FROM suppliers WHERE LOWER(nom) = $1', [nom.trim().toLowerCase()]);
    if (check.rows.length > 0) return res.status(409).json({ message: 'Ce fournisseur existe déjà.' });

    const insertRes = await pool.query(`
      INSERT INTO suppliers (nom, telephone, email, adresse, matricule_fiscale)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nom, telephone, email, adresse, matricule_fiscale as "matriculeFiscale"
    `, [nom.trim(), telephone ? telephone.trim() : '', email ? email.trim() : '', adresse ? adresse.trim() : '', matriculeFiscale ? matriculeFiscale.trim() : '']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de l’ajout du fournisseur.' });
  }
});

// US 21: Modifier un fournisseur
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nom, telephone, email, adresse, matriculeFiscale } = req.body;

    const updated = await pool.query(`
      UPDATE suppliers
      SET nom = COALESCE($1, nom),
          telephone = COALESCE($2, telephone),
          email = COALESCE($3, email),
          adresse = COALESCE($4, adresse),
          matricule_fiscale = COALESCE($5, matricule_fiscale)
      WHERE id = $6
      RETURNING id, nom, telephone, email, adresse, matricule_fiscale as "matriculeFiscale"
    `, [
      nom ? nom.trim() : null,
      telephone !== undefined ? telephone.trim() : null,
      email !== undefined ? email.trim() : null,
      adresse !== undefined ? adresse.trim() : null,
      matriculeFiscale !== undefined ? matriculeFiscale.trim() : null,
      id
    ]);

    if (updated.rows.length === 0) return res.status(404).json({ message: 'Fournisseur introuvable.' });
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification du fournisseur.' });
  }
});

// US 22: Supprimer un fournisseur
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const checkDeliveries = await pool.query('SELECT 1 FROM deliveries WHERE fournisseur_id = $1 LIMIT 1', [id]);
    if (checkDeliveries.rows.length > 0) {
      return res.status(400).json({ message: 'Impossible de supprimer ce fournisseur car des livraisons y sont associées.' });
    }

    await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    res.json({ message: 'Fournisseur supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression du fournisseur.' });
  }
});

export default router;
