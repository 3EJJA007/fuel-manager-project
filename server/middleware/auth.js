import jwt from 'jsonwebtoken';
import { db } from '../database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'fuel-manager-iset-charguia-2026-secret-key';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise. Jeton JWT manquant.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou compte révoqué.' });
    }
    // Omit password from req.user
    const { motDePasse, ...safeUser } = user;
    req.user = safeUser;
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

