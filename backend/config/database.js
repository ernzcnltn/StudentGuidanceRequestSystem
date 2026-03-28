const mysql = require('mysql2/promise');
require('dotenv').config();

// ✅ EKLE - Environment check
const isDevelopment = process.env.NODE_ENV !== 'production';

// Database connection pool - ✅ GÜNCELLE
const pool = mysql.createPool({
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_NAME ,
  waitForConnections: true,
  connectionLimit: isDevelopment ? 10 : 100, // ✅ Dev: 10, Prod: 100
  queueLimit: 0,
  enableKeepAlive: true, // ✅ EKLE
  keepAliveInitialDelay: 0, // ✅ EKLE
  // ✅ EKLE - Production için SSL
  ...(isDevelopment ? {} : {
    ssl: {
      rejectUnauthorized: false // Production'da gerekirse true yap
    }
  })
});

// Test database connection - ✅ GÜNCELLE
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ Database connected successfully (${process.env.NODE_ENV || 'development'})`); // ✅ Environment bilgisi ekle
    connection.release();
    return true; // ✅ EKLE - Success döndür
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false; // ✅ EKLE - Failure döndür
  }
};

module.exports = { pool, testConnection };