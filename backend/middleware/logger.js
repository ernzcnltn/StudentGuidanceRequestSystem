const fs = require('fs');
const path = require('path');

// Logs klasörünü oluştur
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Request logger middleware
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  const logEntry = {
    timestamp,
    method,
    url,
    ip,
    userAgent,
    body: method === 'POST' || method === 'PUT' ? req.body : undefined
  };
  
  // Console'a yazdır
  console.log(`${timestamp} - ${method} ${url} - ${ip}`);
  
  // Dosyaya yaz
  const logFile = path.join(logsDir, `requests-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  
  next();
};

// Error logger
const errorLogger = (error, req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  
  const errorEntry = {
    timestamp,
    method,
    url,
    error: {
      message: error.message,
      stack: error.stack,
      status: error.status || 500
    },
    body: req.body
  };
  
  // Console'a yazdır
  console.error(`${timestamp} - ERROR ${method} ${url}:`, error.message);
  
  // Error dosyasına yaz
  const errorFile = path.join(logsDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(errorFile, JSON.stringify(errorEntry) + '\n');
  
  next(error);
};

// Success response logger
const responseLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    const timestamp = new Date().toISOString();
    const statusCode = res.statusCode;
    
    if (statusCode >= 200 && statusCode < 300) {
      console.log(`${timestamp} - ${req.method} ${req.url} - ${statusCode} Success`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  requestLogger,
  errorLogger,
  responseLogger
};