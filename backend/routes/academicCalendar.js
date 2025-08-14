// backend/routes/academicCalendar.js - Academic Calendar Management
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const mammoth = require('mammoth'); // For .docx parsing

// Configure multer for calendar document uploads
const calendarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/calendars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `calendar-${uniqueSuffix}-${sanitizedName}`);
  }
});

const calendarUpload = multer({
  storage: calendarStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain', // .txt
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Word documents (.doc, .docx), text files, and PDFs are allowed'));
    }
  }
});

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get admin details with permissions
    const [adminResult] = await pool.execute(
      'SELECT admin_id, username, full_name, department, is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [decoded.admin_id]
    );

    if (adminResult.length === 0) {
      return res.status(403).json({ success: false, error: 'Admin not found or inactive' });
    }

    req.admin = adminResult[0];
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
};

// Super admin check middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || !req.admin.is_super_admin) {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required for academic calendar management'
    });
  }
  next();
};

// Academic calendar document text extraction service
class CalendarDocumentParser {
  
  // Parse Word document (.docx)
  static async parseWordDocument(filePath) {
    try {
      console.log('📄 Parsing Word document:', filePath);
      
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      
      console.log('📄 Extracted text length:', text.length);
      console.log('📄 Sample text:', text.substring(0, 200) + '...');
      
      return {
        success: true,
        text: text,
        messages: result.messages || []
      };
    } catch (error) {
      console.error('❌ Word document parsing error:', error);
      return {
        success: false,
        error: error.message,
        text: null
      };
    }
  }

  // Parse text file
  static async parseTextFile(filePath) {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return {
        success: true,
        text: text,
        messages: []
      };
    } catch (error) {
      console.error('❌ Text file parsing error:', error);
      return {
        success: false,
        error: error.message,
        text: null
      };
    }
  }

  // Main parsing function
  static async parseDocument(filePath, mimeType) {
    console.log('🔍 Starting document parsing:', { filePath, mimeType });
    
    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await this.parseWordDocument(filePath);
      
      case 'text/plain':
        return await this.parseTextFile(filePath);
      
      default:
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}`,
          text: null
        };
    }
  }

  // Extract dates and events from text
  static extractEventsFromText(text, academicYear) {
    console.log('📅 Extracting events from text for academic year:', academicYear);
    
    const events = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Turkish month names mapping
    const turkishMonths = {
      'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06',
      'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12',
      'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
      'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    // Academic year parsing (e.g., "2025-2026")
    const [startYear, endYear] = academicYear.split('-').map(y => parseInt(y));
    
    // Regex patterns for date extraction
    const datePatterns = [
      // Turkish format: "15-19 Eylül 2025"
      /(\d{1,2})-(\d{1,2})\s+(\w+)\s+(\d{4})/gi,
      // Single date: "29 Ekim 2025"
      /(\d{1,2})\s+(\w+)\s+(\d{4})/gi,
      // Date range with different months: "19 Aralık 2025 - 3 Ocak 2026"
      /(\d{1,2})\s+(\w+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})/gi
    ];

    for (const line of lines) {
      const originalLine = line;
      let eventName = line;
      let eventType = 'holiday';
      let startDate = null;
      let endDate = null;
      let isRecurring = false;
      let recurringType = 'none';
      
      // Determine event type based on keywords
      if (line.toLowerCase().includes('bayram')) {
        eventType = 'holiday';
        isRecurring = true;
        if (line.toLowerCase().includes('ramazan') || line.toLowerCase().includes('eid_al_fitr')) {
          recurringType = 'eid_al_fitr';
        } else if (line.toLowerCase().includes('kurban') || line.toLowerCase().includes('eid_al_adha')) {
          recurringType = 'eid_al_adha';
        }
      } else if (line.toLowerCase().includes('tatil')) {
        eventType = 'break';
      } else if (line.toLowerCase().includes('sınav')) {
        eventType = 'exam_period';
      } else if (line.toLowerCase().includes('kayıt')) {
        eventType = 'registration';
      } else if (line.toLowerCase().includes('oryantasyon')) {
        eventType = 'orientation';
      } else if (line.toLowerCase().includes('derslerin başlaması') || line.toLowerCase().includes('derslerin son günü')) {
        eventType = 'semester_start';
      }

      // Extract dates using patterns
      let dateMatch = null;
      
      // Try date range pattern first (15-19 Eylül 2025)
      const rangePattern = /(\d{1,2})-(\d{1,2})\s+(\w+)\s+(\d{4})/gi;
      dateMatch = rangePattern.exec(line);
      
      if (dateMatch) {
        const [, startDay, endDay, monthName, year] = dateMatch;
        const monthNum = turkishMonths[monthName.toLowerCase()];
        
        if (monthNum && parseInt(year) >= startYear && parseInt(year) <= endYear) {
          startDate = `${year}-${monthNum}-${startDay.padStart(2, '0')}`;
          endDate = `${year}-${monthNum}-${endDay.padStart(2, '0')}`;
          
          // Remove date part from event name
          eventName = line.replace(dateMatch[0], '').trim();
        }
      } else {
        // Try single date pattern (29 Ekim 2025)
        const singlePattern = /(\d{1,2})\s+(\w+)\s+(\d{4})/gi;
        dateMatch = singlePattern.exec(line);
        
        if (dateMatch) {
          const [, day, monthName, year] = dateMatch;
          const monthNum = turkishMonths[monthName.toLowerCase()];
          
          if (monthNum && parseInt(year) >= startYear && parseInt(year) <= endYear) {
            startDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
            endDate = startDate; // Single day event
            
            // Remove date part from event name
            eventName = line.replace(dateMatch[0], '').trim();
          }
        } else {
          // Try cross-month range pattern
          const crossRangePattern = /(\d{1,2})\s+(\w+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})/gi;
          dateMatch = crossRangePattern.exec(line);
          
          if (dateMatch) {
            const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateMatch;
            const startMonthNum = turkishMonths[startMonth.toLowerCase()];
            const endMonthNum = turkishMonths[endMonth.toLowerCase()];
            
            if (startMonthNum && endMonthNum) {
              startDate = `${startYear}-${startMonthNum}-${startDay.padStart(2, '0')}`;
              endDate = `${endYear}-${endMonthNum}-${endDay.padStart(2, '0')}`;
              
              // Remove date part from event name
              eventName = line.replace(dateMatch[0], '').trim();
            }
          }
        }
      }

      // Clean up event name
      eventName = eventName.replace(/^[-–\s]+|[-–\s]+$/g, '').trim();
      
      // Only add events with valid dates
      if (startDate && endDate && eventName) {
        // Determine if this affects request creation
        const affectsRequests = !line.toLowerCase().includes('yoklama alınacaktır') && 
                              !line.toLowerCase().includes('ders değerlendirmesi yapılmayacaktır') &&
                              eventType !== 'registration';
        
        events.push({
          event_type: eventType,
          event_name: eventName,
          start_date: startDate,
          end_date: endDate,
          is_recurring: isRecurring,
          recurring_type: recurringType,
          affects_request_creation: affectsRequests,
          description: `Extracted from: ${originalLine}`,
          priority_level: eventType === 'holiday' ? 'high' : 'medium',
          source_line: originalLine
        });
        
        console.log(`✅ Extracted event: ${eventName} (${startDate} to ${endDate})`);
      }
    }

    console.log(`📅 Total events extracted: ${events.length}`);
    return events;
  }
}

// Routes

// POST /api/academic-calendar/upload - Upload and parse academic calendar document
router.post('/upload', authenticateAdmin, requireSuperAdmin, calendarUpload.single('calendar_document'), async (req, res) => {
  try {
    const { academic_year } = req.body;
    const file = req.file;
    
    console.log('📤 Academic calendar upload started:', {
      academic_year,
      filename: file?.originalname,
      filesize: file?.size,
      admin: req.admin.username
    });

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No document uploaded'
      });
    }

    if (!academic_year) {
      return res.status(400).json({
        success: false,
        error: 'Academic year is required (e.g., "2025-2026")'
      });
    }

    // Validate academic year format
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(academic_year)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid academic year format. Use format: "2025-2026"'
      });
    }

    // Create upload record
    const [uploadResult] = await pool.execute(`
      INSERT INTO academic_calendar_uploads (
        file_name, file_path, file_type, file_size, 
        academic_year, uploaded_by, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [
      file.originalname,
      file.filename,
      file.mimetype,
      file.size,
      academic_year,
      req.admin.admin_id
    ]);

    const uploadId = uploadResult.insertId;

    // Log parsing start
    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message)
      VALUES (?, 'upload', 'completed', 'File uploaded successfully')
    `, [uploadId]);

    // Parse document
    console.log('🔍 Starting document parsing...');
    
    // Update status to processing
    await pool.execute(`
      UPDATE academic_calendar_uploads 
      SET processing_status = 'processing' 
      WHERE upload_id = ?
    `, [uploadId]);

    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message)
      VALUES (?, 'text_extraction', 'started', 'Starting text extraction')
    `, [uploadId]);

    // Extract text from document
    const parseResult = await CalendarDocumentParser.parseDocument(file.path, file.mimetype);
    
    if (!parseResult.success) {
      await pool.execute(`
        UPDATE academic_calendar_uploads 
        SET processing_status = 'failed', processing_notes = ?
        WHERE upload_id = ?
      `, [parseResult.error, uploadId]);

      await pool.execute(`
        INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message, error_details)
        VALUES (?, 'text_extraction', 'failed', 'Text extraction failed', ?)
      `, [uploadId, parseResult.error]);

      return res.status(400).json({
        success: false,
        error: 'Failed to parse document',
        details: parseResult.error
      });
    }

    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message, data_extracted)
      VALUES (?, 'text_extraction', 'completed', 'Text extracted successfully', JSON_OBJECT('text_length', ?))
    `, [uploadId, parseResult.text.length]);

    // Extract events from text
    console.log('📅 Extracting events from text...');
    
    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message)
      VALUES (?, 'date_parsing', 'started', 'Starting event extraction')
    `, [uploadId]);

    const events = CalendarDocumentParser.extractEventsFromText(parseResult.text, academic_year);

    if (events.length === 0) {
      await pool.execute(`
        UPDATE academic_calendar_uploads 
        SET processing_status = 'failed', processing_notes = 'No events could be extracted from document'
        WHERE upload_id = ?
      `, [uploadId]);

      await pool.execute(`
        INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message)
        VALUES (?, 'date_parsing', 'failed', 'No events extracted from text')
      `, [uploadId]);

      return res.status(400).json({
        success: false,
        error: 'No events could be extracted from the document',
        extracted_text_sample: parseResult.text.substring(0, 500),
        parsing_messages: parseResult.messages
      });
    }

    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message, data_extracted)
      VALUES (?, 'date_parsing', 'completed', 'Events extracted successfully', JSON_OBJECT('event_count', ?))
    `, [uploadId, events.length]);

    // Deactivate old calendars for this academic year
    await pool.execute(`
      UPDATE academic_calendar_uploads 
      SET is_active = FALSE 
      WHERE academic_year = ? AND upload_id != ?
    `, [academic_year, uploadId]);

    // Insert events into database
    console.log('💾 Saving events to database...');
    
    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message)
      VALUES (?, 'event_creation', 'started', 'Starting event creation')
    `, [uploadId]);

    for (const event of events) {
      await pool.execute(`
        INSERT INTO academic_calendar_events (
          upload_id, event_type, event_name, event_name_en, start_date, end_date,
          is_recurring, recurring_type, description, affects_request_creation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uploadId,
        event.event_type,
        event.event_name,
        event.event_name, // For now, use same name for English
        event.start_date,
        event.end_date,
        event.is_recurring,
        event.recurring_type,
        event.description,
        event.affects_request_creation
      ]);
    }

    // Mark as completed
    await pool.execute(`
      UPDATE academic_calendar_uploads 
      SET processing_status = 'completed', processing_notes = ?
      WHERE upload_id = ?
    `, [`Successfully processed ${events.length} events`, uploadId]);

    await pool.execute(`
      INSERT INTO document_parsing_logs (upload_id, parsing_stage, status, message, data_extracted)
      VALUES (?, 'completed', 'completed', 'Calendar processing completed successfully', JSON_OBJECT('total_events', ?))
    `, [uploadId, events.length]);

    // Update current academic year setting
    await pool.execute(`
      UPDATE academic_settings 
      SET setting_value = ? 
      WHERE setting_key = 'current_academic_year'
    `, [academic_year]);

    console.log('✅ Academic calendar upload completed successfully');

    res.json({
      success: true,
      message: 'Academic calendar uploaded and processed successfully',
      data: {
        upload_id: uploadId,
        academic_year: academic_year,
        events_processed: events.length,
        file_info: {
          original_name: file.originalname,
          size: file.size,
          type: file.mimetype
        },
        events_summary: events.map(e => ({
          name: e.event_name,
          type: e.event_type,
          start_date: e.start_date,
          end_date: e.end_date,
          affects_requests: e.affects_request_creation
        }))
      }
    });

  } catch (error) {
    console.error('❌ Academic calendar upload error:', error);
    
    if (req.file) {
      // Clean up uploaded file on error
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process academic calendar',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/academic-calendar/status - Get current academic calendar status
router.get('/status', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 Getting academic calendar status...');

    // Get current academic year and settings
    const [settings] = await pool.execute(`
      SELECT setting_key, setting_value, description 
      FROM academic_settings 
      WHERE setting_key IN ('current_academic_year', 'academic_calendar_enabled', 'holiday_buffer_hours')
    `);

    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    // Get current active calendar
    const [activeCalendar] = await pool.execute(`
      SELECT 
        acu.*,
        COALESCE(event_counts.total_events, 0) as total_events,
        event_counts.earliest_event,
        event_counts.latest_event
      FROM academic_calendar_uploads acu
      LEFT JOIN (
        SELECT 
          upload_id,
          COUNT(*) as total_events,
          MIN(start_date) as earliest_event,
          MAX(end_date) as latest_event
        FROM academic_calendar_events 
        GROUP BY upload_id
      ) event_counts ON acu.upload_id = event_counts.upload_id
      WHERE acu.is_active = TRUE AND acu.processing_status = 'completed'
      ORDER BY acu.uploaded_at DESC
      LIMIT 1
    `);

    // Get today's status - with error handling
    let todayStatus = null;
    try {
      const [holidayResult] = await pool.execute(`
        SELECT is_academic_holiday_detailed(CURDATE()) as holiday_info
      `);
      
      if (holidayResult[0] && holidayResult[0].holiday_info) {
        todayStatus = JSON.parse(holidayResult[0].holiday_info);
      }
    } catch (functionError) {
      console.warn('⚠️ Holiday function not available:', functionError.message);
      todayStatus = {
        is_holiday: false,
        message: 'Holiday check function not available',
        can_create_requests: true
      };
    }

    // Get next available date - with error handling  
    let nextAvailable = null;
    try {
      const [nextResult] = await pool.execute(`
        SELECT get_next_request_creation_date(CURDATE()) as next_info
      `);
      
      if (nextResult[0] && nextResult[0].next_info) {
        nextAvailable = JSON.parse(nextResult[0].next_info);
      }
    } catch (functionError) {
      console.warn('⚠️ Next date function not available:', functionError.message);
    }

    // Get upcoming events (next 30 days) - simplified query
    let upcomingEvents = [];
    try {
      const [upcomingResult] = await pool.execute(`
        SELECT 
          ace.event_name,
          ace.event_type,
          ace.start_date,
          ace.end_date,
          ace.affects_request_creation,
          DATEDIFF(ace.start_date, CURDATE()) as days_until
        FROM academic_calendar_events ace
        JOIN academic_calendar_uploads acu ON ace.upload_id = acu.upload_id
        WHERE ace.start_date >= CURDATE() 
          AND ace.start_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          AND acu.is_active = TRUE 
          AND acu.processing_status = 'completed'
        ORDER BY ace.start_date ASC
        LIMIT 10
      `);
      upcomingEvents = upcomingResult;
    } catch (eventsError) {
      console.warn('⚠️ Could not fetch upcoming events:', eventsError.message);
    }

    res.json({
      success: true,
      data: {
        settings: settingsMap,
        active_calendar: activeCalendar[0] || null,
        today_status: todayStatus,
        next_available: nextAvailable,
        upcoming_events: upcomingEvents,
        system_info: {
          current_date: new Date().toISOString().split('T')[0],
          academic_year: settingsMap.current_academic_year,
          calendar_enabled: settingsMap.academic_calendar_enabled === 'true',
          buffer_hours: parseInt(settingsMap.holiday_buffer_hours || '24'),
          functions_available: {
            holiday_check: todayStatus !== null,
            next_date: nextAvailable !== null
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Get calendar status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// GET /api/academic-calendar/events - Get calendar events
router.get('/events', authenticateAdmin, async (req, res) => {
  try {
    const { 
      academic_year, 
      start_date, 
      end_date, 
      event_type,
      affects_requests_only 
    } = req.query;

    console.log('📅 Getting calendar events:', { academic_year, start_date, end_date, event_type });

    let query = `
      SELECT 
        ace.*,
        acu.academic_year,
        acu.file_name as source_file,
        CASE 
          WHEN CURDATE() BETWEEN ace.start_date AND ace.end_date THEN 'active'
          WHEN ace.start_date > CURDATE() THEN 'upcoming'
          ELSE 'past'
        END as status
      FROM academic_calendar_events ace
      JOIN academic_calendar_uploads acu ON ace.upload_id = acu.upload_id
      WHERE acu.is_active = TRUE AND acu.processing_status = 'completed'
    `;

    const params = [];

    if (academic_year) {
      query += ` AND acu.academic_year = ?`;
      params.push(academic_year);
    }

    if (start_date) {
      query += ` AND ace.end_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND ace.start_date <= ?`;
      params.push(end_date);
    }

    if (event_type) {
      query += ` AND ace.event_type = ?`;
      params.push(event_type);
    }

    if (affects_requests_only === 'true') {
      query += ` AND ace.affects_request_creation = TRUE`;
    }

    query += ` ORDER BY ace.start_date ASC`;

    const [events] = await pool.execute(query, params);

    // Group events by type for summary
    const eventSummary = events.reduce((acc, event) => {
      if (!acc[event.event_type]) {
        acc[event.event_type] = 0;
      }
      acc[event.event_type]++;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        events: events,
        summary: {
          total_events: events.length,
          events_by_type: eventSummary,
          affecting_requests: events.filter(e => e.affects_request_creation).length,
          date_range: {
            earliest: events.length > 0 ? events[0].start_date : null,
            latest: events.length > 0 ? events[events.length - 1].end_date : null
          }
        },
        filters_applied: {
          academic_year,
          start_date,
          end_date,
          event_type,
          affects_requests_only: affects_requests_only === 'true'
        }
      }
    });

  } catch (error) {
    console.error('❌ Get calendar events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar events'
    });
  }
});

// GET /api/academic-calendar/check-date/:date - Check if specific date is holiday
router.get('/check-date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    console.log('🗓️ Checking date:', date);

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if date is valid
    const checkDate = new Date(date);
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date'
      });
    }

    // Get holiday information for the date
    const [result] = await pool.execute(`
      SELECT is_academic_holiday_detailed(?) as holiday_info
    `, [date]);

    const holidayInfo = result[0]?.holiday_info ? JSON.parse(result[0].holiday_info) : null;

    // Get events on this date
    const [events] = await pool.execute(`
      SELECT 
        event_name,
        event_type,
        start_date,
        end_date,
        affects_request_creation,
        is_recurring,
        recurring_type
      FROM active_calendar_events
      WHERE ? BETWEEN start_date AND end_date
      ORDER BY start_date ASC
    `, [date]);

    // Check if it's weekend
    const dayOfWeek = checkDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    res.json({
      success: true,
      data: {
        date: date,
        day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        is_weekend: isWeekend,
        holiday_info: holidayInfo,
        events_on_date: events,
        can_create_requests: !isWeekend && (!holidayInfo || !holidayInfo.is_holiday),
        summary: {
          is_holiday: holidayInfo?.is_holiday || false,
          is_working_day: !isWeekend && (!holidayInfo || !holidayInfo.is_holiday),
          total_events: events.length,
          blocking_events: events.filter(e => e.affects_request_creation).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Check date error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check date'
    });
  }
});

// POST /api/academic-calendar/settings - Update calendar settings
router.post('/settings', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { 
      academic_calendar_enabled, 
      holiday_buffer_hours, 
      current_academic_year 
    } = req.body;

    console.log('⚙️ Updating calendar settings:', req.body);

    const updates = [];
    const params = [];

    if (typeof academic_calendar_enabled !== 'undefined') {
      updates.push('(?, ?, ?, ?)');
      params.push('academic_calendar_enabled', academic_calendar_enabled ? 'true' : 'false', 'Enable/disable academic calendar restrictions', req.admin.admin_id);
    }

    if (holiday_buffer_hours !== undefined) {
      const bufferHours = parseInt(holiday_buffer_hours);
      if (isNaN(bufferHours) || bufferHours < 0 || bufferHours > 168) {
        return res.status(400).json({
          success: false,
          error: 'Holiday buffer hours must be between 0 and 168'
        });
      }
      updates.push('(?, ?, ?, ?)');
      params.push('holiday_buffer_hours', bufferHours.toString(), 'Hours before/after holidays when requests are also blocked', req.admin.admin_id);
    }

    if (current_academic_year) {
      const yearPattern = /^\d{4}-\d{4}$/;
      if (!yearPattern.test(current_academic_year)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid academic year format. Use format: "2025-2026"'
        });
      }
      updates.push('(?, ?, ?, ?)');
      params.push('current_academic_year', current_academic_year, 'Currently active academic year', req.admin.admin_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No settings provided to update'
      });
    }

    // Update settings using INSERT ... ON DUPLICATE KEY UPDATE
    await pool.execute(`
      INSERT INTO academic_settings (setting_key, setting_value, description, updated_by)
      VALUES ${updates.join(', ')}
      ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      description = VALUES(description),
      updated_by = VALUES(updated_by),
      updated_at = CURRENT_TIMESTAMP
    `, params);

    console.log('✅ Calendar settings updated successfully');

    res.json({
      success: true,
      message: 'Calendar settings updated successfully',
      updated_settings: {
        academic_calendar_enabled,
        holiday_buffer_hours,
        current_academic_year
      }
    });

  } catch (error) {
    console.error('❌ Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update calendar settings'
    });
  }
});

// GET /api/academic-calendar/uploads - Get upload history
router.get('/uploads', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    // Fix: Convert query parameters to integers properly
    let { limit = '20', offset = '0' } = req.query;
    
    // Ensure they are numbers and within reasonable bounds
    limit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    offset = Math.max(parseInt(offset) || 0, 0);

    console.log('📋 Getting calendar upload history with params:', { limit, offset });

    const [uploads] = await pool.execute(`
      SELECT 
        acu.upload_id,
        acu.file_name,
        acu.file_path,
        acu.file_type,
        acu.file_size,
        acu.academic_year,
        acu.uploaded_by,
        acu.uploaded_at,
        acu.is_active,
        acu.processing_status,
        acu.processing_notes,
        COALESCE(au.username, 'Unknown') as uploaded_by_username,
        COALESCE(au.full_name, au.username, 'Unknown') as uploaded_by_name,
        COALESCE(event_counts.events_count, 0) as events_count,
        COALESCE(log_counts.log_entries, 0) as log_entries
      FROM academic_calendar_uploads acu
      LEFT JOIN admin_users au ON acu.uploaded_by = au.admin_id
      LEFT JOIN (
        SELECT upload_id, COUNT(*) as events_count 
        FROM academic_calendar_events 
        GROUP BY upload_id
      ) event_counts ON acu.upload_id = event_counts.upload_id
      LEFT JOIN (
        SELECT upload_id, COUNT(*) as log_entries 
        FROM document_parsing_logs 
        GROUP BY upload_id
      ) log_counts ON acu.upload_id = log_counts.upload_id
      ORDER BY acu.uploaded_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [totalCount] = await pool.execute(`
      SELECT COUNT(*) as total FROM academic_calendar_uploads
    `);

    console.log(`✅ Retrieved ${uploads.length} uploads`);

    res.json({
      success: true,
      data: {
        uploads: uploads,
        pagination: {
          total: totalCount[0].total,
          limit: limit,
          offset: offset,
          has_more: totalCount[0].total > (offset + uploads.length)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get uploads error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/academic-calendar/upload/:uploadId - Delete calendar upload
router.delete('/upload/:uploadId', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    console.log('🗑️ Deleting calendar upload:', uploadId);

    // Get upload info
    const [uploadInfo] = await pool.execute(`
      SELECT * FROM academic_calendar_uploads WHERE upload_id = ?
    `, [uploadId]);

    if (uploadInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calendar upload not found'
      });
    }

    const upload = uploadInfo[0];

    // Delete events (cascade will handle this, but explicit for clarity)
    await pool.execute(`
      DELETE FROM academic_calendar_events WHERE upload_id = ?
    `, [uploadId]);

    // Delete parsing logs
    await pool.execute(`
      DELETE FROM document_parsing_logs WHERE upload_id = ?
    `, [uploadId]);

    // Delete upload record
    await pool.execute(`
      DELETE FROM academic_calendar_uploads WHERE upload_id = ?
    `, [uploadId]);

    // Delete physical file
    const filePath = path.join(__dirname, '../uploads/calendars', upload.file_path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Physical file deleted:', filePath);
      }
    } catch (fileError) {
      console.error('⚠️ Could not delete physical file:', fileError);
    }

    console.log('✅ Calendar upload deleted successfully');

    res.json({
      success: true,
      message: 'Calendar upload deleted successfully',
      deleted_upload: {
        upload_id: uploadId,
        file_name: upload.file_name,
        academic_year: upload.academic_year
      }
    });

  } catch (error) {
    console.error('❌ Delete upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete calendar upload'
    });
  }
});

// GET /api/academic-calendar/parsing-logs/:uploadId - Get parsing logs for upload
router.get('/parsing-logs/:uploadId', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    console.log('📋 Getting parsing logs for upload:', uploadId);

    const [logs] = await pool.execute(`
      SELECT * FROM document_parsing_logs 
      WHERE upload_id = ? 
      ORDER BY created_at ASC
    `, [uploadId]);

    const [uploadInfo] = await pool.execute(`
      SELECT file_name, academic_year, processing_status 
      FROM academic_calendar_uploads 
      WHERE upload_id = ?
    `, [uploadId]);

    if (uploadInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found'
      });
    }

    res.json({
      success: true,
      data: {
        upload_info: uploadInfo[0],
        logs: logs,
        summary: {
          total_stages: logs.length,
          successful_stages: logs.filter(log => log.status === 'completed').length,
          failed_stages: logs.filter(log => log.status === 'failed').length,
          total_processing_time: logs.reduce((sum, log) => sum + (log.processing_time_seconds || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get parsing logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get parsing logs'
    });
  }
});

module.exports = router;