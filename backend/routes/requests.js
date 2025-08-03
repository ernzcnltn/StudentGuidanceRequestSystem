const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { validateCreateRequest, validateStatusUpdate, validateIdParam } = require('../middleware/validation');
const { upload, handleUploadError } = require('../middleware/upload');

const path = require('path');
const fs = require('fs');


// GET /api/requests - Tüm talepleri getir
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        gr.request_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        s.name as student_name,
        s.student_number,
        s.email as student_email,
        rt.type_name,
        rt.category,
        rt.is_document_required,
        COUNT(a.attachment_id) as attachment_count
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      GROUP BY gr.request_id
      ORDER BY 
        CASE gr.priority 
          WHEN 'Urgent' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
        END,
        gr.submitted_at DESC
    `;
    
    const [rows] = await pool.execute(query);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch requests' 
    });
  }
});

// GET /api/requests/student/:studentId - Belirli bir öğrencinin taleplerini getir
router.get('/student/:studentId', async (req, res) => {
  try {
    const query = `
      SELECT 
        gr.request_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        rt.type_name,
        rt.category,
        COUNT(a.attachment_id) as attachment_count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      WHERE gr.student_id = ?
      GROUP BY gr.request_id
      ORDER BY 
        CASE gr.priority 
          WHEN 'Urgent' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
        END,
        gr.submitted_at DESC
    `;
    
    const [rows] = await pool.execute(query, [req.params.studentId]);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching student requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student requests' 
    });
  }
});


    
   
// PUT /api/requests/:id/status - Update status with email notification
router.put('/:id/status', validateIdParam, validateStatusUpdate, async (req, res) => {
  try {
    const { status, response_content } = req.body;
    const requestId = req.params.id;
    
    // Get current request details
    const [requestCheck] = await pool.execute(`
      SELECT 
        gr.request_id, 
        gr.status as current_status,
        s.name as student_name,
        s.email as student_email,
        rt.type_name
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ?
    `, [requestId]);
    
    if (requestCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    const request = requestCheck[0];
    const oldStatus = request.current_status;
    
    // Update request status
    const [result] = await pool.execute(
      'UPDATE guidance_requests SET status = ?, updated_at = NOW(), resolved_at = CASE WHEN ? = "Completed" THEN NOW() ELSE resolved_at END WHERE request_id = ?',
      [status, status, requestId]
    );
    
    // Add response if provided
    if (response_content) {
      await pool.execute(
        'INSERT INTO admin_responses (request_id, response_content, created_at) VALUES (?, ?, NOW())',
        [requestId, response_content]
      );
    }
    
   
    
    res.json({
      success: true,
      message: 'Request status updated successfully',
      data: {
        request_id: requestId,
        previous_status: oldStatus,
        new_status: status,
        response_content: response_content || null,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update request status' 
    });
  }
});


// POST /api/requests/:id/upload - Dosya yükle
router.post('/:id/upload', upload.array('files', 3), handleUploadError, async (req, res) => {
  try {
    const requestId = req.params.id;
    const files = req.files;
    
    console.log('Uploaded files:', files);
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    // Request'in var olup olmadığını kontrol et
    const [requestCheck] = await pool.execute(
      'SELECT request_id FROM guidance_requests WHERE request_id = ?',
      [requestId]
    );
    
    if (requestCheck.length === 0) {
      // Yüklenen dosyaları sil
      files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Dosya bilgilerini veritabanına kaydet
    const uploadedFiles = [];
    for (const file of files) {
      console.log('Saving file to DB:', {
        original: file.originalname,
        filename: file.filename,
        path: file.path
      });
      
      const [result] = await pool.execute(
        'INSERT INTO attachments (request_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
        [requestId, file.originalname, file.filename, file.mimetype, file.size]
      );
      
      uploadedFiles.push({
        attachment_id: result.insertId,
        original_name: file.originalname,
        file_name: file.filename,
        file_type: file.mimetype,
        file_size: file.size
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Files uploaded successfully',
      data: {
        request_id: requestId,
        files: uploadedFiles
      }
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    
    // Hata durumunda yüklenen dosyaları temizle
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload files' 
    });
  }
});

// GET /api/requests/:id/attachments - Request'e ait dosyaları listele
router.get('/:id/attachments', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const [rows] = await pool.execute(
      'SELECT attachment_id, file_name, file_path, file_type, file_size, uploaded_at FROM attachments WHERE request_id = ? ORDER BY uploaded_at DESC',
      [requestId]
    );
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attachments' 
    });
  }
});

// GET /api/requests/attachments/:filename - Dosya indirme
router.get('/attachments/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    console.log('Download request for:', filename);
    console.log('File path:', filePath);
    
    // Güvenlik kontrolü - dosya gerçekten var mı
    if (!fs.existsSync(filePath)) {
      console.log('File not found at:', filePath);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Dosya bilgilerini database'den al (güvenlik için)
    const [attachments] = await pool.execute(
      'SELECT * FROM attachments WHERE file_path = ?',
      [filename]
    );
    
    if (attachments.length === 0) {
      console.log('File not found in database:', filename);
      return res.status(404).json({
        success: false,
        error: 'File not found in database'
      });
    }
    
    const attachment = attachments[0];
    console.log('Downloading file:', attachment.file_name);
    
    // Content-Type'ı ayarla
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    
    // Dosyayı gönder
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            error: 'Failed to send file' 
          });
        }
      } else {
        console.log('File sent successfully:', attachment.file_name);
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download file' 
    });
  }
});

// ✅ YENİ EKLENEN: GET /api/requests/:id/responses - Student Request Responses
router.get('/:id/responses', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Request'in var olup olmadığını kontrol et
    const [requestCheck] = await pool.execute(
      'SELECT request_id FROM guidance_requests WHERE request_id = ?',
      [requestId]
    );
    
    if (requestCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Admin responses'ları getir (admin_responses tablosundan)
    const [responses] = await pool.execute(
      `SELECT 
        ar.response_id,
        ar.response_content,
        ar.created_at,
        COALESCE(au.name, au.username, 'Admin') as created_by_admin
      FROM admin_responses ar
      LEFT JOIN admin_users au ON ar.admin_id = au.admin_id
      WHERE ar.request_id = ?
      ORDER BY ar.created_at ASC`,
      [requestId]
    );
    
    res.json({
      success: true,
      data: responses,
      count: responses.length
    });
  } catch (error) {
    console.error('Get student responses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get responses'
    });
  }
});

module.exports = router;