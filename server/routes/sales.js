import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isRestricted = req.user.role === 'gerant' || req.user.role === 'employe';
    const stationId = isRestricted ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    if (isRestricted && !stationId) {
      return res.json([]);
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
    const conditions = [];

    if (stationId) {
      params.push(stationId);
      conditions.push(`s.station_id = $${params.length}`);
    }

    if (req.query.carburantId) {
      params.push(Number(req.query.carburantId));
      conditions.push(`s.carburant_id = $${params.length}`);
    }

    if (req.query.employeId) {
      params.push(Number(req.query.employeId));
      conditions.push(`s.employe_id = $${params.length}`);
    }

    if (req.query.dateDebut) {
      params.push(req.query.dateDebut);
      conditions.push(`DATE(s.date_heure) >= $${params.length}`);
    }

    if (req.query.dateFin) {
      params.push(req.query.dateFin);
      conditions.push(`DATE(s.date_heure) <= $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
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

router.post('/', async (req, res) => {
  const { pompeId, carburantId, quantite, modePaiement } = req.body;

  let stationId = req.user.stationId || (req.user.role === 'admin' ? Number(req.body.stationId) : null);
  if (!stationId) return res.status(400).json({ message: 'Station non spécifiée ou compte non rattaché à une station.' });

  const qte = Number(quantite);
  if (isNaN(qte) || qte <= 0) return res.status(400).json({ message: 'Quantité positive requise.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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

    const tankRes = await client.query(
      'SELECT * FROM tanks WHERE station_id = $1 AND carburant_id = $2 LIMIT 1 FOR UPDATE',
      [stationId, fuel.id]
    );

    if (tankRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Aucune cuve configurée pour « ${fuel.libelle} ».` });
    }
    const tank = tankRes.rows[0];

    const currentNiv = Number(tank.niveau_actuel);
    if (currentNiv < qte) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `Stock insuffisant pour « ${fuel.libelle} » ! Disponible : ${currentNiv.toFixed(1)} L, demandée : ${qte.toFixed(1)} L.`
      });
    }

    const prixUnitaire = Number(fuel.prix_unitaire);
    const montant = Number((qte * prixUnitaire).toFixed(3));
    const nouveauNiveau = Number((currentNiv - qte).toFixed(2));

    await client.query('UPDATE tanks SET niveau_actuel = $1 WHERE id = $2', [nouveauNiveau, tank.id]);

    const numeroRecu = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const now = new Date().toISOString();

    const insertSale = await client.query(`
      INSERT INTO sales (numero_recu, station_id, pompe_id, cuve_id, carburant_id, employe_id, quantite, prix_unitaire, montant, date_heure, mode_paiement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, numero_recu as "numeroRecu", date_heure as "dateHeure", quantite, prix_unitaire as "prixUnitaire", montant, mode_paiement as "modePaiement"
    `, [numeroRecu, stationId, pump ? pump.id : null, tank.id, fuel.id, req.user.id, qte, prixUnitaire, montant, now, modePaiement || 'Espèces']);

    await client.query(`
      INSERT INTO stock_movements (date_heure, station_id, cuve_id, carburant_id, type, quantite, ancien_niveau, nouveau_niveau, reference_id, auteur)
      VALUES ($1, $2, $3, $4, 'SORTIE_VENTE', $5, $6, $7, $8, $9)
    `, [now, stationId, tank.id, fuel.id, qte, currentNiv, nouveauNiveau, numeroRecu, `${req.user.prenom || ''} ${req.user.nom}`.trim()]);

    const seuil = Number(fuel.seuil_minimal || 3000);
    const isUnderSeuil = nouveauNiveau <= seuil;

    if (isUnderSeuil) {
      const existingAlert = await client.query(
        'SELECT id FROM alerts WHERE cuve_id = $1 AND traitee = false',
        [tank.id]
      );
      let alertId;
      if (existingAlert.rows.length === 0) {
        const alRes = await client.query(`
          INSERT INTO alerts (station_id, cuve_id, carburant_id, quantite_restante, seuil_minimal, traitee)
          VALUES ($1, $2, $3, $4, $5, false)
          RETURNING id
        `, [stationId, tank.id, fuel.id, nouveauNiveau, seuil]);
        alertId = alRes.rows[0].id;
      } else {
        alertId = existingAlert.rows[0].id;
        await client.query('UPDATE alerts SET quantite_restante = $1, date_heure = CURRENT_TIMESTAMP WHERE id = $2', [nouveauNiveau, alertId]);
      }

      const notifyUsers = await client.query(`
        SELECT id FROM users WHERE (role = 'gerant' AND station_id = $1) OR role = 'admin'
      `, [stationId]);
      const alerteMsg = `⚠️ Stock Faible : La cuve #${tank.id} (${fuel.libelle}) est à ${nouveauNiveau} L (seuil : ${seuil} L).`;
      for (const u of notifyUsers.rows) {
        await client.query(`
          INSERT INTO notifications (user_id, message, type, alerte_id)
          VALUES ($1, $2, 'alerte_stock', $3)
        `, [u.id, alerteMsg, alertId]);
      }
    }

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
        alerteFaible: isUnderSeuil
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
