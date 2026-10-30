import { db } from '../server/database.js';

console.log('Réinitialisation et amorçage des données de test...');
db.resetToInitial();
console.log('✅ Base de données initialisée avec succès avec les stations, cuves, pompes et utilisateurs.');

