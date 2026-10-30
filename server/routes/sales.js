import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Consulter les ventes
router.get('/', async (req, res) => {
  try {
    let stationId = req.query.stationId ? Number(req.query.stationId) : null;
    if (req.user.role === 'gerant' || req.user.role === 'employe') {
      stationId = req.user.stationId;
    }

    let queryText = `
      SELECT s.id, s.numero_recu as "numeroRecu", s.date_heure as "dateHeure",
             s.quantite, s.prix_unitaire as "prixUnitaire", s.montant, s.mode_paiement as "modePaiement",
             s.station_id as "stationId", s.pompe_id as "pompeId", s.carburant_id as "carburantId", s.employe_id as "employeId",
             f.libelle as "carburant", p.numero as "pompeNumero", st.nom as "stationNom",
             concat(u.prenom, ' ', u.nom) as "employeNom"
      FROM sales s
      JOIN fuels f ON s.carburant_id = f.id
      JOIN stations st ON s.station_id = st.id
      LEFT JOIN pumps p ON s.pompe_id = p.id
      LEFT JOIN users u ON s.employe_id = u.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE s.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY s.date_heure DESC, s.id DESC';

    const result = await pool.query(queryText, params);
    const sales = result.rows.map(s => ({
      ...s,
      quantite: Number(s.quantite),
      prixUnitaire: Number(s.prixUnitaire),
      montant: Number(s.montant)
    }));
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des ventes.' });
  }
});

// US 26, 27, 28: Enregistrer une vente avec transaction atomique
router.post('/', async (req, res) => {
  const { pompeId, carburantId, quantite, modePaiement } = req.body;

  let stationId = req.user.stationId || Number(req.body.stationId);
  if (!stationId) return res.status(400).json({ message: 'Station non spécifiée ou non rattachée.' });

  const qte = Number(quantite);
  if (isNaN(qte) || qte <= 0) return res.status(400).json({ message: 'Quantité positive requise.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve pump and fuel
    let pump = null;
    let carbId = carburantId ? Number(carburantId) : null;

    if (pompeId) {
      const pRes = await client.query('SELECT * FROM pumps WHERE id = $1', [Number(pompeId)]);
      if (pRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Pompe introuvable.' });
      }
      pump = pRes.rows[0];
      if (pump.etat !== 'En service') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `La pompe n° ${pump.numero} est actuellement « ${pump.etat} ».` });
      }
      carbId = pump.carburant_id;
    }

    const fuelRes = await client.query('SELECT * FROM fuels WHERE id = $1', [carbId]);
    if (fuelRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Carburant invalide.' });
    }
    const fuel = fuelRes.rows[0];

    // 2. Lock tank for update
    const tankRes = await client.query(
      'SELECT * FROM tanks WHERE station_id = $1 AND carburant_id = $2 LIMIT 1 FOR UPDATE',
      [stationId, fuel.id]
    );

    if (tankRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Aucune cuve configurée pour « ${fuel.libelle} ».` });
    }
    const tank = tankRes.rows[0];

    // 3. Stock availability check (sequence diagram: 409 if insufficient)
    const currentNiv = Number(tank.niveau_actuel);
    if (currentNiv < qte) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `Stock insuffisant pour « ${fuel.libelle} » ! Disponible : ${currentNiv.toFixed(1)} L, demandée : ${qte.toFixed(1)} L.`
      });
    }

    // 4. US 27: Montant = Quantité * Prix Unitaire
    const prixUnitaire = Number(fuel.prix_unitaire);
    const montant = Number((qte * prixUnitaire).toFixed(3));
    const nouveauNiveau = Number((currentNiv - qte).toFixed(2));

    // 5. Decrement tank level
    await client.query('UPDATE tanks SET niveau_actuel = $1 WHERE id = $2', [nouveauNiveau, tank.id]);

    // 6. Generate receipt number & insert sale
    const numeroRecu = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const now = new Date().toISOString();

    const insertSale = await client.query(`
      INSERT INTO sales (numero_recu, station_id, pompe_id, cuve_id, carburant_id, employe_id, quantite, prix_unitaire, montant, date_heure, mode_paiement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, numero_recu as "numeroRecu", date_heure as "dateHeure", quantite, prix_unitaire as "prixUnitaire", montant, mode_paiement as "modePaiement"
    `, [numeroRecu, stationId, pump ? pump.id : null, tank.id, fuel.id, req.user.id, qte, prixUnitaire, montant, now, modePaiement || 'Espèces']);

    // 7. Insert stock movement
    await client.query(`
      INSERT INTO stock_movements (date_heure, station_id, cuve_id, carburant_id, type, quantite, ancien_niveau, nouveau_niveau, reference_id, auteur)
      VALUES ($1, $2, $3, $4, 'SORTIE_VENTE', $5, $6, $7, $8, $9)
    `, [now, stationId, tank.id, fuel.id, qte, currentNiv, nouveauNiveau, numeroRecu, `${req.user.prenom || ''} ${req.user.nom}`.trim()]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vente enregistrée avec succès.',
      sale: {
        ...insertSale.rows[0],
        carburant: fuel.libelle,
        pompeNumero: pump ? pump.numero : '—',
        quantite: qte,
        prixUnitaire,
        montant,
        alerteFaible: nouveauNiveau <= Number(fuel.seuil_minimal || 3000)
      },
      stockRestant: nouveauNiveau
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sale error:', err);
    res.status(500).json({ message: 'Erreur lors de l’enregistrement de la vente.' });
  } finally {
    client.release();
  }
});

export default router;
