const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET /api/request-types - Talep türlerini getir
router.get('/', async (req, res) => {
  try {
    console.log('Request types endpoint called'); // Debug için
    
    const [rows] = await pool.execute(
      'SELECT * FROM request_types WHERE is_disabled = FALSE ORDER BY category, type_name'
    );
    
    console.log('Found rows:', rows.length); // Debug için
    
    // Kategorilere göre grupla
    const grouped = rows.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: grouped,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching request types:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch request types',
      details: error.message
    });
  }
});

// GET /api/request-types/:id - Belirli bir talep türünü getir
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM request_types WHERE type_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request type not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching request type:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch request type',
      details: error.message
    });
  }
});



module.exports = router;