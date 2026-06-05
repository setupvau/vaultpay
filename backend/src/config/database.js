// src/config/database.js
const { Pool } = require('pg');

// Validate DATABASE_URL exists before trying to connect
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in your .env file');
  console.error('Copy your connection string from Supabase → Settings → Database → URI');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Database connected successfully');
  }
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Query failed:', error.message);
    throw error;
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { query, transaction, pool };
