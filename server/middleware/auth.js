import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'fuel-manager-iset-charguia-2026-secret-key';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise. Jeton JWT manquant.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.station_id as "stationId", u.telephone,
              s.nom as "stationNom", s.ville as "stationVille"
       FROM users u
       LEFT JOIN stations s ON u.station_id = s.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou compte révoqué.' });
    }

    const row = result.rows[0];
    req.user = {
      id: row.id,
      nom: row.nom,
      prenom: row.prenom,
      email: row.email,
      role: row.role,
      stationId: row.stationId,
      telephone: row.telephone,
      station: row.stationId ? { id: row.stationId, nom: row.stationNom, ville: row.stationVille } : null
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Jeton JWT invalide ou expiré.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Accès refusé. Rôle requis: [${allowedRoles.join(', ')}], votre rôle: ${req.user.role}` 
      });
    }
    next();
  };
}
