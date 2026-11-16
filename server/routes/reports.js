import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isGerant = req.user.role === 'gerant';
    const stationId = isGerant ? req.user.stationId : (req.query.stationId ? Number(req.query.stationId) : null);

    let queryText = `
      SELECT r.id, r.type, r.station_id as "stationId", r.date_debut as "dateDebut",
             r.date_fin as "dateFin", r.format, r.date_generation as "dateGeneration",
             r.user_id as "userId", r.donnees,
             s.nom as "stationNom", concat(u.prenom, ' ', u.nom) as "auteur"
      FROM reports r
      LEFT JOIN stations s ON r.station_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
    `;
    const params = [];
    if (stationId) {
      queryText += ' WHERE r.station_id = $1';
      params.push(stationId);
    }
    queryText += ' ORDER BY r.date_generation DESC LIMIT 30';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des rapports.' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { type, stationId, dateDebut, dateFin, format } = req.body;
    const isGerant = req.user.role === 'gerant';
    const targetStationId = isGerant ? req.user.stationId : (stationId ? Number(stationId) : null);

    if (isGerant && !targetStationId) {
      return res.status(403).json({ message: 'Aucune station rattachée.' });
    }

    const startDate = dateDebut ? new Date(dateDebut).toISOString().split('T')[0] : '2020-01-01';
    const endDate = dateFin ? new Date(dateFin).toISOString().split('T')[0] : '2099-12-31';

    let salesWhere = 'WHERE DATE(s.date_heure) >= $1 AND DATE(s.date_heure) <= $2';
    let deliveriesWhere = 'WHERE DATE(d.date) >= $1 AND DATE(d.date) <= $2';
    const sParams = [startDate, endDate];
    const dParams = [startDate, endDate];

    if (targetStationId) {
      salesWhere += ' AND s.station_id = $3';
      sParams.push(targetStationId);
      deliveriesWhere += ' AND d.station_id = $3';
      dParams.push(targetStationId);
    }

    const salesRes = await pool.query(`
      SELECT s.id, s.numero_recu as "numeroRecu", s.date_heure as "dateHeure",
             s.quantite, s.prix_unitaire as "prixUnitaire", s.montant, s.mode_paiement as "modePaiement",
             f.libelle as "carburant", st.nom as "stationNom", concat(u.prenom, ' ', u.nom) as "caissier"
      FROM sales s
      JOIN fuels f ON s.carburant_id = f.id
      JOIN stations st ON s.station_id = st.id
      LEFT JOIN users u ON s.employe_id = u.id
      ${salesWhere}
      ORDER BY s.date_heure DESC
    `, sParams);

    const delivRes = await pool.query(`
      SELECT d.id, d.numero_bon as "numeroBon", d.date, d.quantite, d.prix_achat as "prixAchat",
             f.libelle as "carburant", sup.nom as "fournisseur", st.nom as "stationNom"
      FROM deliveries d
      JOIN fuels f ON d.carburant_id = f.id
      JOIN suppliers sup ON d.fournisseur_id = sup.id
      JOIN stations st ON d.station_id = st.id
      ${deliveriesWhere}
      ORDER BY d.date DESC
    `, dParams);

    const totalVentesMontant = salesRes.rows.reduce((sum, s) => sum + Number(s.montant || 0), 0);
    const totalVentesVolume = salesRes.rows.reduce((sum, s) => sum + Number(s.quantite || 0), 0);
    const totalAchatsMontant = delivRes.rows.reduce((sum, d) => sum + (Number(d.quantite || 0) * Number(d.prixAchat || 0)), 0);
    const totalAchatsVolume = delivRes.rows.reduce((sum, d) => sum + Number(d.quantite || 0), 0);

    const donnees = {
      periode: { dateDebut: startDate, dateFin: endDate },
      stationId: targetStationId,
      totaux: {
        ventesCount: salesRes.rows.length,
        ventesMontant: Number(totalVentesMontant.toFixed(3)),
        ventesVolume: Number(totalVentesVolume.toFixed(2)),
        achatsCount: delivRes.rows.length,
        achatsMontant: Number(totalAchatsMontant.toFixed(3)),
        achatsVolume: Number(totalAchatsVolume.toFixed(2)),
        margeBrute: Number((totalVentesMontant - totalAchatsMontant).toFixed(3))
      },
      ventes: salesRes.rows.slice(0, 100),
      livraisons: delivRes.rows.slice(0, 100)
    };

    const reportType = type || 'Rapport d’Activité';
    const reportFormat = format || 'PDF';

    const insertRes = await pool.query(`
      INSERT INTO reports (type, station_id, date_debut, date_fin, format, user_id, donnees)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, type, station_id as "stationId", date_debut as "dateDebut", date_fin as "dateFin",
                format, date_generation as "dateGeneration", donnees
    `, [reportType, targetStationId, startDate, endDate, reportFormat, req.user.id, JSON.stringify(donnees)]);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ message: 'Erreur lors de la génération du rapport.' });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const reportId = Number(req.params.id);
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rapport introuvable.' });
    }

    const report = result.rows[0];
    const data = report.donnees;
    const format = req.query.format || report.format;

    if (format === 'CSV' || format === 'EXCEL') {
      let csv = '\uFEFF';
      csv += `RAPPORT :;${report.type}\r\n`;
      csv += `Date de génération :;${new Date(report.date_generation).toLocaleString('fr-FR')}\r\n`;
      csv += `Période :;Du ${data.periode?.dateDebut} au ${data.periode?.dateFin}\r\n\r\n`;

      csv += `SYNTHÈSE FINANCIÈRE ET VOLUMES\r\n`;
      csv += `Nombre de ventes :;${data.totaux?.ventesCount}\r\n`;
      csv += `Volume total vendu :;${data.totaux?.ventesVolume} Litres\r\n`;
      csv += `Recette totale :;${data.totaux?.ventesMontant} DT\r\n`;
      csv += `Nombre de livraisons :;${data.totaux?.achatsCount}\r\n`;
      csv += `Volume total approvisionné :;${data.totaux?.achatsVolume} Litres\r\n`;
      csv += `Coût total des achats :;${data.totaux?.achatsMontant} DT\r\n`;
      csv += `Marge brute estimée :;${data.totaux?.margeBrute} DT\r\n\r\n`;

      csv += `DÉTAIL DES VENTES\r\n`;
      csv += `N° Reçu;Date & Heure;Station;Carburant;Quantité (L);Prix Unit (DT);Total (DT);Règlement;Caissier\r\n`;
      (data.ventes || []).forEach(v => {
        csv += `"${v.numeroRecu}";"${v.dateHeure}";"${v.stationNom}";"${v.carburant}";${v.quantite};${v.prixUnitaire};${v.montant};"${v.modePaiement}";"${v.caissier || ''}"\r\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rapport_${report.id}_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de l’export du rapport.' });
  }
});

export default router;
