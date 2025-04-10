const { Pool } = require('pg');

const isRender = process.env.NODE_ENV === 'production'; // Render définit NODE_ENV=production
const connectionString = isRender 
    ? process.env.DATABASE_URL // Internal sur Render
    : process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL_RENDER; // External en local

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) console.error('Erreur de connexion à PostgreSQL :', err.stack);
    else console.log('Connecté à PostgreSQL !');
});

module.exports = pool;