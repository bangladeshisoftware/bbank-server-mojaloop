// src/utils/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Optional: test connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database.');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

module.exports = { pool };