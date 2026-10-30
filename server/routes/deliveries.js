import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Consulter les livraisons
router.get('/', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant') {
      stationId = req.user.stationId;
    }

    let queryText = `
      SELECT d.id, d.numero_bon as "numeroBon", d.date, d.quantite, d.prix_achat as "prixAchat", d.notes,
             d.station_id as "stationId", d.cuve_id as "cuveId", d.carburant_id as "carburantId", d.fournisseur_id as "fournisseurId",
             s.nom as "fournisseur", f.libelle as "carburant", st.nom as "station",
             concat('Cuve #', d.cuve_id, ' (', f.libelle, ')') as cuve
      FROM deliveries d
      JOIN suppliers s ON d.fournisseur_id = s.id
      JOIN fuels f ON d.carburant_id = f.id
      JOIN stations st ON d.station_id = st.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE d.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY d.date DESC, d.id DESC';

    const result = await pool.query(queryText, params);
    const deliveries = result.rows.map(d => ({
      ...d,
      quantite: Number(d.quantite),
      prixAchat: Number(d.prixAchat)
    }));
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des livraisons.' });
  }
});

// US 24 & 25: Enregistrer une livraison (Transaction PostgreSQL)
router.post('/', async (req, res) => {
  if (req.user.role !== 'gerant' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux gérants et administrateurs.' });
  }

  let stationId = req.user.role === 'gerant' ? req.user.stationId : Number(req.body.stationId);
  if (!stationId) return res.status(400).json({ message: 'Station non spécifiée.' });

  const { numeroBon, fournisseurId, carburantId, cuveId, quantite, prixAchat, date, notes } = req.body;
  if (!numeroBon || !fournisseurId || !carburantId || quantite === undefined) {
    return res.status(400).json({ message: 'Champs obligatoires manquants.' });
  }

  const qte = Number(quantite);
  if (isNaN(qte) || qte <= 0) return res.status(400).json({ message: 'Quantité positive requise.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check unique numero_bon
    const existing = await client.query('SELECT id FROM deliveries WHERE LOWER(numero_bon) = $1', [numeroBon.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Le bon « ${numeroBon} » existe déjà.` });
    }

    // 2. Find and lock target tank (FOR UPDATE)
    let tankRes;
    if (cuveId) {
      tankRes = await client.query('SELECT * FROM tanks WHERE id = $1 FOR UPDATE', [Number(cuveId)]);
    } else {
      tankRes = await client.query('SELECT * FROM tanks WHERE station_id = $1 AND carburant_id = $2 LIMIT 1 FOR UPDATE', [stationId, Number(carburantId)]);
    }

    if (tankRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cuve correspondante introuvable.' });
    }

    const tank = tankRes.rows[0];
    const spaceLeft = Number(tank.capacite) - Number(tank.niveau_actuel);
    if (qte > spaceLeft) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Capacité dépassée ! Espace disponible : ${spaceLeft} L. Quantité livrée : ${qte} L.`
      });
    }

    const ancienNiveau = Number(tank.niveau_actuel);
    const nouveauNiveau = ancienNiveau + qte;

    // 3. Update tank level
    await client.query('UPDATE tanks SET niveau_actuel = $1 WHERE id = $2', [nouveauNiveau, tank.id]);

    // 4. Insert delivery
    const deliveryDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const insertDel = await client.query(`
      INSERT INTO deliveries (numero_bon, station_id, cuve_id, carburant_id, fournisseur_id, quantite, prix_achat, date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, numero_bon as "numeroBon", quantite, prix_achat as "prixAchat", date
    `, [numeroBon.trim(), stationId, tank.id, Number(carburantId), Number(fournisseurId), qte, Number(prixAchat || 0), deliveryDate, notes ? notes.trim() : '']);

    // 5. Insert stock movement
    await client.query(`
      INSERT INTO stock_movements (date_heure, station_id, cuve_id, carburant_id, type, quantite, ancien_niveau, nouveau_niveau, reference_id, auteur)
      VALUES ($1, $2, $3, $4, 'ENTREE_LIVRAISON', $5, $6, $7, $8, $9)
    `, [deliveryDate, stationId, tank.id, Number(carburantId), qte, ancienNiveau, nouveauNiveau, numeroBon.trim(), `${req.user.prenom || ''} ${req.user.nom}`.trim()]);

    await client.query('COMMIT');

    const fuelRes = await pool.query('SELECT libelle FROM fuels WHERE id = $1', [carburantId]);
    res.status(201).json({
      message: 'Livraison enregistrée et stock mis à jour avec succès.',
      delivery: insertDel.rows[0],
      cuve: {
        id: tank.id,
        carburant: fuelRes.rows[0]?.libelle || '',
        ancienNiveau,
        nouveauNiveau,
        capacite: Number(tank.capacite)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delivery error:', err);
    res.status(500).json({ message: 'Erreur lors de l’enregistrement de la livraison.' });
  } finally {
    client.release();
  }
});

export default router;
