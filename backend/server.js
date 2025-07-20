const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Database connection
const { testConnection } = require('./config/database');

// Logger middleware
const { requestLogger, errorLogger, responseLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logger middleware'leri
app.use(requestLogger);
app.use(responseLogger);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test database connection
testConnection();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin-auth', require('./routes/adminAuth')); // YENİ EKLENEN
app.use('/api/request-types', require('./routes/requestTypes'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/students', require('./routes/students'));

app.use('/api/docs', require('./routes/docs'));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'FIU Guidance System API is working!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the API at: http://localhost:${PORT}/api/test`);
});