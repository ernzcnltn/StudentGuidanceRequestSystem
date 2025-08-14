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
  
  // ✅ ENHANCED: Extract events with multi-event support
  static extractEventsFromText(text, academicYear) {
    console.log('📅 Multi-event table-aware extraction for academic year:', academicYear);
    console.log('📄 Processing text sample:', text.substring(0, 500));
    
    const events = [];
    
    // Split text into lines and clean
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !this.isTableBorderOrEmpty(line));
    
    // Enhanced Turkish month mapping
    const turkishMonths = {
      'ocak': '01', 'oca': '01', 'january': '01',
      'şubat': '02', 'şub': '02', 'february': '02', 'subat': '02',
      'mart': '03', 'mar': '03', 'march': '03',
      'nisan': '04', 'nis': '04', 'april': '04',
      'mayıs': '05', 'may': '05', 'mayis': '05',
      'haziran': '06', 'haz': '06', 'june': '06',
      'temmuz': '07', 'tem': '07', 'july': '07',
      'ağustos': '08', 'ağu': '08', 'august': '08', 'agustos': '08',
      'eylül': '09', 'eyl': '09', 'september': '09', 'eylul': '09',
      'ekim': '10', 'eki': '10', 'october': '10',
      'kasım': '11', 'kas': '11', 'november': '11', 'kasim': '11',
      'aralık': '12', 'ara': '12', 'december': '12', 'aralik': '12'
    };

    // Academic year parsing
    const [startYear, endYear] = academicYear.split('-').map(y => parseInt(y));
    
    console.log(`📋 Processing ${lines.length} lines for multi-event extraction...`);

    // ✅ NEW: Group lines by date patterns
    const dateGroups = this.groupLinesByDates(lines, turkishMonths, startYear, endYear);
    
    // ✅ NEW: Process each date group
    for (const group of dateGroups) {
      const { startDate, endDate, eventLines, originalDateLine } = group;
      
      if (!startDate || !endDate) continue;
      
      console.log(`📅 Processing date group: ${startDate} to ${endDate}`);
      console.log(`   Found ${eventLines.length} events for this date`);
      
      // ✅ NEW: Create separate events for each line in the date group
      for (const eventLine of eventLines) {
        let eventName = this.cleanEventName(eventLine);
        
        if (eventName.length <= 3 || this.isJustFormatting(eventName)) {
          continue;
        }
        
        const eventType = this.determineEventType(eventName, eventLine);
        const affectsRequests = this.determineAffectsRequests(eventName, eventLine);
        
        events.push({
          event_type: eventType,
          event_name: eventName,
          start_date: startDate,
          end_date: endDate,
          is_recurring: this.determineIsRecurring(eventName),
          recurring_type: this.determineRecurringType(eventName),
          affects_request_creation: affectsRequests,
          description: `Extracted from: ${originalDateLine} | ${eventLine}`,
          priority_level: this.determinePriorityLevel(eventType, eventName),
          source_line: originalDateLine,
          event_line: eventLine,
          extraction_method: 'multi_event_table'
        });
        
        console.log(`✅ Added event: ${eventName} (${startDate} to ${endDate})`);
      }
    }

    console.log(`📅 Total events extracted: ${events.length}`);
    this.logExtractionSummary(events);
    
    return events;
  }

  // ✅ NEW: Group lines by their date patterns
  static groupLinesByDates(lines, turkishMonths, startYear, endYear) {
    const groups = [];
    let currentGroup = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip headers and formatting
      if (this.isHeaderOrFormatting(line)) {
        continue;
      }
      
      // ✅ Check if this line contains a date
      const dateInfo = this.extractDateFromLine(line, turkishMonths, startYear, endYear);
      
      if (dateInfo.hasDate) {
        // ✅ This line has a date - start new group or finish current group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        
        currentGroup = {
          startDate: dateInfo.startDate,
          endDate: dateInfo.endDate,
          originalDateLine: line,
          eventLines: []
        };
        
        // ✅ Add event text from same line if present
        if (dateInfo.eventText && dateInfo.eventText.length > 3) {
          currentGroup.eventLines.push(dateInfo.eventText);
        }
        
      } else if (currentGroup) {
        // ✅ This line doesn't have date - add to current group as additional event
        const cleanLine = this.cleanEventName(line);
        if (cleanLine.length > 3 && !this.isJustFormatting(cleanLine)) {
          currentGroup.eventLines.push(cleanLine);
        }
      }
    }
    
    // ✅ Add last group
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  // ✅ NEW: Extract date information from a single line
  static extractDateFromLine(line, turkishMonths, startYear, endYear) {
    const result = {
      hasDate: false,
      startDate: null,
      endDate: null,
      eventText: null
    };
    
    // ✅ Try multiple date patterns
    const patterns = [
      // Pattern 1: "**15-19 September 2025**" or "15-19 September 2025"
      {
        regex: /\*{0,2}(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})\*{0,2}/gi,
        type: 'range_same_month'
      },
      // Pattern 2: "**29 October 2025**" or "29 October 2025"  
      {
        regex: /\*{0,2}(\d{1,2})\s+(\w+)\s+(\d{4})\*{0,2}/gi,
        type: 'single_date'
      },
      // Pattern 3: "19 December 2025 - 3 January 2026"
      {
        regex: /(\d{1,2})\s+(\w+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})/gi,
        type: 'cross_month_range'
      }
    ];
    
    for (const pattern of patterns) {
      const match = pattern.regex.exec(line);
      if (match) {
        if (pattern.type === 'range_same_month') {
          const [fullMatch, startDay, endDay, monthName, year] = match;
          const monthNum = turkishMonths[monthName.toLowerCase()];
          
          if (monthNum && parseInt(year) >= startYear && parseInt(year) <= endYear) {
            result.hasDate = true;
            result.startDate = `${year}-${monthNum}-${startDay.padStart(2, '0')}`;
            result.endDate = `${year}-${monthNum}-${endDay.padStart(2, '0')}`;
            result.eventText = line.replace(fullMatch, '').trim();
            break;
          }
        } else if (pattern.type === 'single_date') {
          const [fullMatch, day, monthName, year] = match;
          const monthNum = turkishMonths[monthName.toLowerCase()];
          
          if (monthNum && parseInt(year) >= startYear && parseInt(year) <= endYear) {
            result.hasDate = true;
            result.startDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
            result.endDate = result.startDate;
            result.eventText = line.replace(fullMatch, '').trim();
            break;
          }
        } else if (pattern.type === 'cross_month_range') {
          const [fullMatch, startDay, startMonth, startYear, endDay, endMonth, endYear] = match;
          const startMonthNum = turkishMonths[startMonth.toLowerCase()];
          const endMonthNum = turkishMonths[endMonth.toLowerCase()];
          
          if (startMonthNum && endMonthNum) {
            result.hasDate = true;
            result.startDate = `${startYear}-${startMonthNum}-${startDay.padStart(2, '0')}`;
            result.endDate = `${endYear}-${endMonthNum}-${endDay.padStart(2, '0')}`;
            result.eventText = line.replace(fullMatch, '').trim();
            break;
          }
        }
      }
    }
    
    return result;
  }

  // ✅ ENHANCED: Clean event name more thoroughly
  static cleanEventName(text) {
    return text
      .replace(/^[-–\s*|]+|[-–\s*|]+$/g, '') // Remove table chars and markers
      .replace(/\*+/g, '') // Remove asterisks
      .replace(/\|+/g, '') // Remove pipes
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^(for|to|and|the|a|an)\s+/gi, '') // Remove common prefixes
      .trim();
  }

  // ✅ ENHANCED: Better event type detection for specific events
  static determineEventType(eventName, fullLine) {
    const lowerName = eventName.toLowerCase();
    const lowerLine = fullLine.toLowerCase();
    
    // ✅ More specific patterns
    if (lowerName.includes('bayram') || lowerLine.includes('holiday')) {
      return 'holiday';
    } else if (lowerName.includes('tatil') || lowerName.includes('break')) {
      return 'break';
    } else if (lowerName.includes('sınav') || lowerName.includes('exam')) {
      return 'exam_period';
    } else if (lowerName.includes('kayıt') || lowerName.includes('registration')) {
      return 'registration';
    } else if (lowerName.includes('oryantasyon') || lowerName.includes('orientation')) {
      return 'orientation';
    } else if (lowerName.includes('başvuru') || lowerName.includes('application')) {
      return 'application';
    } else if (lowerName.includes('derslerin başlaması') || lowerName.includes('first day of classes')) {
      return 'semester_start';
    } else if (lowerName.includes('derslerin son günü') || lowerName.includes('last day of classes')) {
      return 'semester_end';
    } else if (lowerName.includes('mezuniyet') || lowerName.includes('graduation')) {
      return 'graduation';
    } else if (lowerName.includes('telafi') || lowerName.includes('make-up')) {
      return 'makeup_classes';
    } else if (lowerName.includes('proficiency') || lowerName.includes('placement')) {
      return 'placement_test';
    } else {
      return 'academic_event';
    }
  }

  // ✅ ENHANCED: More accurate request blocking logic
  static determineAffectsRequests(eventName, fullLine) {
    const lowerName = eventName.toLowerCase();
    const lowerLine = fullLine.toLowerCase();
    
    // ✅ These should NOT block requests (academic processes)
    const noBlockPatterns = [
      'registration', 'kayıt', 'başvuru', 'application',
      'orientation', 'oryantasyon',
      'proficiency', 'placement', 'exam', 'sınav',
      'teslimi', 'açıklanması', 'announcement',
      'first day', 'last day', 'derslerin',
      'course selection', 'ders seçim'
    ];
    
    // ✅ These SHOULD block requests (holidays, breaks)
    const blockPatterns = [
      'holiday', 'tatil', 'bayram',
      'christmas', 'noel',
      'republic day', 'cumhuriyet',
      'new year', 'yeni yıl',
      'memorial day', 'atatürk',
      'national sovereignty', 'ulusal egemenlik',
      'labor day', 'emek ve dayanışma',
      'peace and freedom', 'barış ve özgürlük',
      'victory day', 'zafer'
    ];
    
    // Check no-block patterns first
    if (noBlockPatterns.some(pattern => lowerName.includes(pattern) || lowerLine.includes(pattern))) {
      return false;
    }
    
    // Check block patterns
    if (blockPatterns.some(pattern => lowerName.includes(pattern) || lowerLine.includes(pattern))) {
      return true;
    }
    
    return false; // Default: don't block
  }

  // ✅ Keep all other existing methods unchanged
  static async parseWordDocument(filePath) {
    try {
      console.log('📄 Parsing Word document with multi-event support:', filePath);
      
      const mammoth = require('mammoth');
      const fs = require('fs');
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found', text: null };
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return { success: false, error: 'File is empty', text: null };
      }
      
      const result = await mammoth.extractRawText({ 
        path: filePath,
        options: {
          includeEmbeddedStyleMap: true,
          includeDefaultStyleMap: true
        }
      });
      
      let text = result.value
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\+[-=]+\+/g, '\n')
        .replace(/^\s*\|\s*/gm, '')
        .replace(/\s*\|\s*$/gm, '')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      
      if (!text || text.length === 0) {
        return { success: false, error: 'No readable text found', text: null };
      }
      
      console.log('📄 Multi-event parsed text length:', text.length);
      
      return { success: true, text: text, messages: result.messages || [] };
    } catch (error) {
      console.error('❌ Multi-event parsing error:', error);
      return { success: false, error: error.message, text: null };
    }
  }

  static isTableBorderOrEmpty(line) {
    const borderPatterns = [
      /^\s*\+[-=]+\+\s*$/, /^\s*\|[\s\|]*\|\s*$/, /^\s*[-=]{3,}\s*$/, /^\s*$/
    ];
    return borderPatterns.some(pattern => pattern.test(line));
  }

  static isHeaderOrFormatting(line) {
    const formatPatterns = [
      /^[*+=\-]{3,}/, /^\s*\|\s*\*\*/, /LİSANS.*PROGRAMLARI/i,
      /AKADEMİK.*TAKVİMİ/i, /FALL.*SEMESTER/i, /SPRING.*SEMESTER/i, /SUMMER.*SCHOOL/i,
      /^\s*\+[-=]+\+/, /^\s*[-=]{5,}/, /tablo|table|başlık|header/i,
      /UNDERGRADUATE.*PROGRAMS/i, /ACADEMIC.*CALENDAR/i
    ];
    return formatPatterns.some(pattern => pattern.test(line));
  }

  static isJustFormatting(text) {
    const formattingPatterns = [
      /^[\s\*\|\+\-=]+$/, /^(başlık|header|title)$/i, /^(gün|day|date)$/i,
      /^(olay|event|etkinlik)$/i, /^(for|to|and|the|a|an)$/i
    ];
    return formattingPatterns.some(pattern => pattern.test(text.trim()));
  }

  static determineIsRecurring(eventName) {
    const recurringEvents = [
      'cumhuriyet bayramı', 'republic day', 'ramazan bayramı', 'kurban bayramı', 
      'yeni yıl', 'new year', 'noel', 'christmas', 'atatürk', 'memorial day',
      'ulusal egemenlik', 'national sovereignty', 'zafer bayramı', 'victory day'
    ];
    const lowerName = eventName.toLowerCase();
    return recurringEvents.some(event => lowerName.includes(event));
  }

  static determineRecurringType(eventName) {
    const lowerName = eventName.toLowerCase();
    
    if (lowerName.includes('ramazan')) return 'eid_fitr';
    if (lowerName.includes('kurban')) return 'eid_adha';
    if (lowerName.includes('cumhuriyet') || lowerName.includes('republic') || lowerName.includes('atatürk')) return 'national';
    if (lowerName.includes('yeni yıl') || lowerName.includes('new year') || lowerName.includes('noel') || lowerName.includes('christmas')) return 'intl';
    
    return 'none';
  }

  static determinePriorityLevel(eventType, eventName) {
    if (eventType === 'holiday' || eventType === 'break') return 'high';
    if (eventType === 'exam_period') return 'high';
    if (eventType === 'semester_start' || eventType === 'semester_end') return 'high';
    return 'medium';
  }

  static logExtractionSummary(events) {
    console.log('\n📊 MULTI-EVENT EXTRACTION SUMMARY:');
    console.log('===================================');
    
    const typeCount = {};
    const affectsCount = { true: 0, false: 0 };
    
    events.forEach(event => {
      typeCount[event.event_type] = (typeCount[event.event_type] || 0) + 1;
      affectsCount[event.affects_request_creation]++;
    });
    
    console.log('📈 Events by type:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log('\n🎯 Request blocking:');
    console.log(`   Will block requests: ${affectsCount.true}`);
    console.log(`   Won't block requests: ${affectsCount.false}`);
    
    console.log('\n📅 Sample events by date:');
    const eventsByDate = events.reduce((acc, event) => {
      const dateKey = `${event.start_date}${event.end_date !== event.start_date ? ' to ' + event.end_date : ''}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event.event_name);
      return acc;
    }, {});
    
    Object.entries(eventsByDate).slice(0, 5).forEach(([date, eventNames]) => {
      console.log(`   📅 ${date}:`);
      eventNames.forEach(name => console.log(`      - ${name}`));
    });
    
    console.log('===================================\n');
  }

  // Keep existing parseTextFile and parseDocument methods unchanged
  static async parseTextFile(filePath) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found', text: null };
      }
      const text = fs.readFileSync(filePath, 'utf8');
      if (!text || text.length === 0) {
        return { success: false, error: 'File is empty', text: null };
      }
      return { success: true, text: text, messages: [] };
    } catch (error) {
      return { success: false, error: error.message, text: null };
    }
  }

  static async parseDocument(filePath, mimeType) {
    try {
      if (!filePath || !mimeType) {
        return { success: false, error: 'Missing file path or MIME type', text: null };
      }
      
      switch (mimeType) {
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.parseWordDocument(filePath);
        case 'text/plain':
          return await this.parseTextFile(filePath);
        default:
          return { success: false, error: `Unsupported file type: ${mimeType}`, text: null };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Unknown parsing error', text: null };
    }
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

    // Get settings with error handling
    let settings = [];
    try {
      [settings] = await pool.execute(`
        SELECT setting_key, setting_value, description 
        FROM academic_settings 
        WHERE setting_key IN ('current_academic_year', 'academic_calendar_enabled', 'holiday_buffer_hours')
      `);
    } catch (settingsError) {
      console.warn('⚠️ Settings table access failed:', settingsError);
      // Continue with empty settings, will use defaults
    }

    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    // Apply defaults for missing settings
    const defaultSettings = {
      academic_calendar_enabled: settingsMap.academic_calendar_enabled || 'false',
      holiday_buffer_hours: settingsMap.holiday_buffer_hours || '24',
      current_academic_year: settingsMap.current_academic_year || '2025-2026'
    };

    // Get current active calendar with error handling
    let activeCalendar = [];
    try {
      [activeCalendar] = await pool.execute(`
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
    } catch (calendarError) {
      console.warn('⚠️ Active calendar query failed:', calendarError);
      // Continue without active calendar info
    }

    // Get today's status with enhanced error handling
    let todayStatus = null;
    const currentDate = new Date().toISOString().split('T')[0];
    
   if (defaultSettings.academic_calendar_enabled === 'true') {
  try {
    const [holidayResult] = await pool.execute(`
      SELECT is_academic_holiday_detailed(?) as holiday_info
    `, [currentDate]);
    
    console.log('🔍 Raw holiday result:', holidayResult[0]);
    
    if (holidayResult[0] && holidayResult[0].holiday_info) {
      const rawHolidayInfo = holidayResult[0].holiday_info;
      
      // ✅ CRITICAL FIX: Handle different data types
      if (typeof rawHolidayInfo === 'string') {
        try {
          todayStatus = JSON.parse(rawHolidayInfo);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError, 'Raw data:', rawHolidayInfo);
          todayStatus = {
            is_holiday: false,
            message: 'JSON parse error in holiday data',
            parse_error: true
          };
        }
      } else if (typeof rawHolidayInfo === 'object') {
        // Already an object, use directly
        todayStatus = rawHolidayInfo;
      } else {
        console.warn('⚠️ Unexpected holiday info type:', typeof rawHolidayInfo);
        todayStatus = {
          is_holiday: false,
          message: 'Unexpected holiday data format',
          format_error: true
        };
      }
    } else {
      todayStatus = {
        is_holiday: false,
        message: 'No holiday data returned from function',
        no_data: true
      };
    }
  } catch (functionError) {
    console.warn('⚠️ Holiday function not available:', functionError.message);
    todayStatus = {
      is_holiday: false,
      message: 'Holiday check function not available',
      function_error: true,
      error_details: functionError.message
    };
  }
} else {
  todayStatus = {
    is_holiday: false,
    message: 'Academic calendar is disabled',
    calendar_disabled: true
  };
}

    // Get next available date with error handling
    let nextAvailable = null;
   if (defaultSettings.academic_calendar_enabled === 'true') {
  try {
    const [nextResult] = await pool.execute(`
      SELECT get_next_request_creation_date(?) as next_info
    `, [currentDate]);
    
    console.log('🔍 Raw next available result:', nextResult[0]);
    
    if (nextResult[0] && nextResult[0].next_info) {
      const rawNextInfo = nextResult[0].next_info;
      
      // ✅ CRITICAL FIX: Handle different data types
      if (typeof rawNextInfo === 'string') {
        try {
          nextAvailable = JSON.parse(rawNextInfo);
        } catch (parseError) {
          console.error('❌ JSON parse error for next date:', parseError, 'Raw data:', rawNextInfo);
          nextAvailable = {
            success: false,
            error: 'JSON parse error in next date data',
            parse_error: true
          };
        }
      } else if (typeof rawNextInfo === 'object') {
        // Already an object, use directly
        nextAvailable = rawNextInfo;
      } else {
        console.warn('⚠️ Unexpected next info type:', typeof rawNextInfo);
        nextAvailable = {
          success: false,
          error: 'Unexpected next date data format',
          format_error: true
        };
      }
    } else {
      nextAvailable = {
        success: false,
        error: 'No next date data returned from function',
        no_data: true
      };
    }
  } catch (functionError) {
    console.warn('⚠️ Next date function not available:', functionError.message);
    nextAvailable = {
      success: false,
      error: 'Next date function not available',
      function_error: true,
      error_details: functionError.message
    };
  }
}

    // Get upcoming events with error handling
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

    // Compile system health info
    const systemHealth = {
      database_accessible: true,
      settings_table: settings.length > 0,
      calendar_functions: !todayStatus?.function_error,
      active_calendar: activeCalendar.length > 0,
      upcoming_events_count: upcomingEvents.length
    };

    res.json({
      success: true,
      data: {
        settings: defaultSettings,
        active_calendar: activeCalendar[0] || null,
        today_status: todayStatus,
        next_available: nextAvailable,
        upcoming_events: upcomingEvents,
        system_info: {
          current_date: currentDate,
          academic_year: defaultSettings.current_academic_year,
          calendar_enabled: defaultSettings.academic_calendar_enabled === 'true',
          buffer_hours: parseInt(defaultSettings.holiday_buffer_hours || '24'),
          functions_available: {
            holiday_check: !todayStatus?.function_error,
            next_date: !nextAvailable?.function_error
          },
          system_health: systemHealth
        }
      }
    });

  } catch (error) {
    console.error('❌ Get calendar status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar status',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        type: error.constructor.name
      } : undefined
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
    
    console.log('🗓️ Checking date availability:', date);

    // Enhanced date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format',
        provided: date,
        expected_format: 'YYYY-MM-DD',
        example: '2025-12-25'
      });
    }

    // Validate if date is actually valid
    const checkDate = new Date(date + 'T00:00:00');
    if (isNaN(checkDate.getTime()) || checkDate.toISOString().split('T')[0] !== date) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date value',
        provided: date,
        note: 'Date must be a valid calendar date'
      });
    }

    // Check if date is too far in the past or future (reasonable bounds)
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const twoYearsAhead = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
    
    if (checkDate < oneYearAgo || checkDate > twoYearsAhead) {
      return res.status(400).json({
        success: false,
        error: 'Date out of reasonable range',
        provided: date,
        allowed_range: {
          from: oneYearAgo.toISOString().split('T')[0],
          to: twoYearsAhead.toISOString().split('T')[0]
        }
      });
    }

    // Check if academic calendar is enabled
    let calendarEnabled = false;
    try {
      const [settingsResult] = await pool.execute(`
        SELECT setting_value FROM academic_settings 
        WHERE setting_key = 'academic_calendar_enabled'
      `);
      calendarEnabled = settingsResult[0]?.setting_value === 'true';
    } catch (settingsError) {
      console.warn('⚠️ Settings check failed:', settingsError);
    }

    // Get holiday information for the date with error handling
    let holidayInfo = null;
    let holidayCheckError = null;
    
    if (calendarEnabled) {
      try {
        const [result] = await pool.execute(`
          SELECT is_academic_holiday_detailed(?) as holiday_info
        `, [date]);

        if (result[0]?.holiday_info) {
          holidayInfo = JSON.parse(result[0].holiday_info);
        }
      } catch (error) {
        console.error('❌ Holiday check function error:', error);
        holidayCheckError = error.message;
        holidayInfo = {
          is_holiday: false,
          error: 'Holiday check function unavailable'
        };
      }
    } else {
      holidayInfo = {
        is_holiday: false,
        calendar_disabled: true,
        message: 'Academic calendar is disabled'
      };
    }

    // Get events on this date with error handling
    let events = [];
    try {
      const [eventsResult] = await pool.execute(`
        SELECT 
          event_name,
          event_type,
          start_date,
          end_date,
          affects_request_creation,
          is_recurring,
          recurring_type
        FROM academic_calendar_events ace
        JOIN academic_calendar_uploads acu ON ace.upload_id = acu.upload_id
        WHERE ? BETWEEN ace.start_date AND ace.end_date
          AND acu.is_active = TRUE 
          AND acu.processing_status = 'completed'
        ORDER BY ace.start_date ASC
      `, [date]);
      events = eventsResult;
    } catch (eventsError) {
      console.warn('⚠️ Events query failed:', eventsError);
    }

    // Check if it's weekend
    const dayOfWeek = checkDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Determine if requests can be created
    const isHoliday = holidayInfo?.is_holiday || false;
    const hasBlockingEvents = events.some(e => e.affects_request_creation);
    const canCreateRequests = !isWeekend && !isHoliday && !hasBlockingEvents && calendarEnabled;

    // Compile comprehensive response
    res.json({
      success: true,
      data: {
        date: date,
        day_of_week: dayNames[dayOfWeek],
        day_number: dayOfWeek,
        is_weekend: isWeekend,
        holiday_info: holidayInfo,
        events_on_date: events,
        can_create_requests: canCreateRequests,
        calendar_enabled: calendarEnabled,
        restrictions: {
          weekend: isWeekend,
          holiday: isHoliday,
          blocking_events: hasBlockingEvents,
          calendar_disabled: !calendarEnabled
        },
        summary: {
          is_holiday: isHoliday,
          is_working_day: !isWeekend && !isHoliday && calendarEnabled,
          total_events: events.length,
          blocking_events: events.filter(e => e.affects_request_creation).length,
          holiday_check_error: holidayCheckError
        },
        debug_info: process.env.NODE_ENV === 'development' ? {
          check_date_object: checkDate.toISOString(),
          parsed_correctly: checkDate.toISOString().split('T')[0] === date,
          day_calculation: dayOfWeek,
          calendar_function_available: !holidayCheckError
        } : undefined
      }
    });

  } catch (error) {
    console.error('❌ Check date error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check date',
      provided_date: req.params.date,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    console.log('⚙️ Updating calendar settings:', {
      calendar_enabled: academic_calendar_enabled,
      buffer_hours: holiday_buffer_hours,
      academic_year: current_academic_year,
      admin: req.admin.username
    });

    // Validate inputs
    const validationErrors = [];

    if (typeof academic_calendar_enabled !== 'undefined' && typeof academic_calendar_enabled !== 'boolean') {
      validationErrors.push('academic_calendar_enabled must be a boolean');
    }

    if (holiday_buffer_hours !== undefined) {
      const bufferHours = parseInt(holiday_buffer_hours);
      if (isNaN(bufferHours) || bufferHours < 0 || bufferHours > 168) {
        validationErrors.push('holiday_buffer_hours must be between 0 and 168');
      }
    }

    if (current_academic_year) {
      const yearPattern = /^\d{4}-\d{4}$/;
      if (!yearPattern.test(current_academic_year)) {
        validationErrors.push('current_academic_year must be in format "YYYY-YYYY" (e.g., "2025-2026")');
      } else {
        const [startYear, endYear] = current_academic_year.split('-').map(y => parseInt(y));
        if (endYear !== startYear + 1) {
          validationErrors.push('Academic year end must be exactly one year after start year');
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validation_errors: validationErrors,
        provided_values: { academic_calendar_enabled, holiday_buffer_hours, current_academic_year }
      });
    }

    // Prepare updates
    const updates = [];
    const updateValues = [];

    if (typeof academic_calendar_enabled !== 'undefined') {
      updates.push('(?, ?, ?, ?)');
      updateValues.push(
        'academic_calendar_enabled', 
        academic_calendar_enabled ? 'true' : 'false', 
        'Enable/disable academic calendar restrictions', 
        req.admin.admin_id
      );
    }

    if (holiday_buffer_hours !== undefined) {
      const bufferHours = parseInt(holiday_buffer_hours);
      updates.push('(?, ?, ?, ?)');
      updateValues.push(
        'holiday_buffer_hours', 
        bufferHours.toString(), 
        'Hours before/after holidays when requests are also blocked', 
        req.admin.admin_id
      );
    }

    if (current_academic_year) {
      updates.push('(?, ?, ?, ?)');
      updateValues.push(
        'current_academic_year', 
        current_academic_year, 
        'Currently active academic year', 
        req.admin.admin_id
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid settings provided to update',
        accepted_fields: ['academic_calendar_enabled', 'holiday_buffer_hours', 'current_academic_year']
      });
    }

    // Execute the update with proper error handling
    try {
      await pool.execute(`
        INSERT INTO academic_settings (setting_key, setting_value, description, updated_by)
        VALUES ${updates.join(', ')}
        ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        description = VALUES(description),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
      `, updateValues);

      console.log('✅ Calendar settings updated successfully by:', req.admin.username);

      // Return updated settings
      const [updatedSettings] = await pool.execute(`
        SELECT setting_key, setting_value, updated_at 
        FROM academic_settings 
        WHERE setting_key IN ('academic_calendar_enabled', 'holiday_buffer_hours', 'current_academic_year')
      `);

      const settingsMap = {};
      updatedSettings.forEach(setting => {
        settingsMap[setting.setting_key] = setting.setting_value;
      });

      res.json({
        success: true,
        message: 'Calendar settings updated successfully',
        updated_settings: settingsMap,
        updated_by: req.admin.username,
        updated_at: new Date().toISOString(),
        changes_applied: {
          academic_calendar_enabled: typeof academic_calendar_enabled !== 'undefined',
          holiday_buffer_hours: holiday_buffer_hours !== undefined,
          current_academic_year: !!current_academic_year
        }
      });

    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
      
      // Handle specific database errors
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({
          success: false,
          error: 'Academic settings table not found',
          solution: 'Please run database migrations to create required tables'
        });
      }

      throw dbError; // Re-throw for general error handling
    }

  } catch (error) {
    console.error('❌ Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update calendar settings',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        errno: error.errno
      } : undefined
    });
  }
});



// GET /api/academic-calendar/uploads - Get upload history
// backend/routes/academicCalendar.js - KESIN ÇÖZÜM

// ❌ ESKİ KOD (1242. satır civarında):
/*
const [uploads] = await pool.execute(`
  SELECT ... FROM academic_calendar_uploads acu
  LEFT JOIN admin_users au ON acu.uploaded_by = au.admin_id
  ORDER BY acu.uploaded_at DESC
  LIMIT ? OFFSET ?
`, [limit, offset]);
*/

// ✅ YENİ KOD - TAMAMEN DEĞİŞTİRİN:

// GET /api/academic-calendar/uploads - Get upload history
router.get('/uploads', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    // ✅ STEP 1: Parameter validation
    let { limit = '20', offset = '0' } = req.query;
    
    console.log('📋 Raw query params:', {
      limit: limit,
      offset: offset,
      types: { limit: typeof limit, offset: typeof offset }
    });
    
    // ✅ STEP 2: Convert to integers with validation
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    
    // ✅ STEP 3: Validate and set defaults
    const finalLimit = (isNaN(parsedLimit) || parsedLimit < 1) ? 20 : Math.min(parsedLimit, 100);
    const finalOffset = (isNaN(parsedOffset) || parsedOffset < 0) ? 0 : parsedOffset;
    
    console.log('📋 Validated params:', { 
      limit: finalLimit, 
      offset: finalOffset,
      types: { limit: typeof finalLimit, offset: typeof finalOffset }
    });

    // ✅ STEP 4: CRITICAL FIX - Use template literals or string concatenation
    const query = `
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
        COALESCE(au.full_name, au.username, 'Unknown') as uploaded_by_name
      FROM academic_calendar_uploads acu
      LEFT JOIN admin_users au ON acu.uploaded_by = au.admin_id
      ORDER BY acu.uploaded_at DESC
      LIMIT ${finalLimit} OFFSET ${finalOffset}
    `;

    console.log('📋 Executing query:', query);

    // ✅ STEP 5: Execute query WITHOUT parameters
    const [uploads] = await pool.execute(query);

    // ✅ STEP 6: Get event counts for each upload
    const uploadsWithCounts = [];
    for (const upload of uploads) {
      try {
        // Get event count
        const [eventCount] = await pool.execute(
          'SELECT COUNT(*) as events_count FROM academic_calendar_events WHERE upload_id = ?',
          [upload.upload_id]
        );
        
        // Get log count
        const [logCount] = await pool.execute(
          'SELECT COUNT(*) as log_entries FROM document_parsing_logs WHERE upload_id = ?',
          [upload.upload_id]
        );
        
        uploadsWithCounts.push({
          ...upload,
          events_count: eventCount[0]?.events_count || 0,
          log_entries: logCount[0]?.log_entries || 0
        });
      } catch (countError) {
        console.warn('⚠️ Count query failed for upload:', upload.upload_id, countError.message);
        uploadsWithCounts.push({
          ...upload,
          events_count: 0,
          log_entries: 0
        });
      }
    }

    // ✅ STEP 7: Get total count for pagination
    const [totalCountResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM academic_calendar_uploads'
    );
    
    const totalCount = totalCountResult[0]?.total || 0;

    console.log(`✅ Successfully retrieved ${uploadsWithCounts.length} uploads (Total: ${totalCount})`);

    res.json({
      success: true,
      data: {
        uploads: uploadsWithCounts,
        pagination: {
          total: totalCount,
          limit: finalLimit,
          offset: finalOffset,
          returned: uploadsWithCounts.length,
          has_more: totalCount > (finalOffset + uploadsWithCounts.length)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get uploads error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get upload history',
      errorType: error.code || 'UNKNOWN_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        errno: error.errno,
        sqlState: error.sqlState
      } : undefined
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


router.get('/validate/system', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔍 Validating academic calendar system...');

    const validation = {
      database_tables: {},
      sql_functions: {},
      settings: {},
      overall_health: 'unknown'
    };

    // Check required tables exist
    const requiredTables = [
      'academic_calendar_uploads',
      'academic_calendar_events', 
      'academic_settings',
      'document_parsing_logs'
    ];

    for (const table of requiredTables) {
      try {
        await pool.execute(`SELECT 1 FROM ${table} LIMIT 1`);
        validation.database_tables[table] = 'exists';
      } catch (error) {
        validation.database_tables[table] = 'missing';
        console.error(`❌ Table ${table} check failed:`, error.message);
      }
    }

    // Check required SQL functions exist
    const requiredFunctions = [
      'is_academic_holiday_detailed',
      'get_next_request_creation_date'
    ];

    for (const func of requiredFunctions) {
      try {
        const testDate = '2025-01-01';
        await pool.execute(`SELECT ${func}(?) as test_result`, [testDate]);
        validation.sql_functions[func] = 'available';
      } catch (error) {
        validation.sql_functions[func] = 'missing';
        console.error(`❌ Function ${func} check failed:`, error.message);
      }
    }

    // Check settings
    try {
      const [settings] = await pool.execute(`
        SELECT setting_key, setting_value 
        FROM academic_settings 
        WHERE setting_key IN ('academic_calendar_enabled', 'current_academic_year', 'holiday_buffer_hours')
      `);
      
      validation.settings.count = settings.length;
      validation.settings.present = settings.map(s => s.setting_key);
      validation.settings.status = settings.length >= 3 ? 'complete' : 'incomplete';
    } catch (error) {
      validation.settings.status = 'error';
      validation.settings.error = error.message;
    }

    // Determine overall health
    const tablesOk = Object.values(validation.database_tables).every(status => status === 'exists');
    const functionsOk = Object.values(validation.sql_functions).every(status => status === 'available');
    const settingsOk = validation.settings.status === 'complete';

    if (tablesOk && functionsOk && settingsOk) {
      validation.overall_health = 'healthy';
    } else if (tablesOk) {
      validation.overall_health = 'partial';
    } else {
      validation.overall_health = 'unhealthy';
    }

    // Add recommendations
    validation.recommendations = [];
    
    if (!tablesOk) {
      validation.recommendations.push('Run database migrations to create missing tables');
    }
    if (!functionsOk) {
      validation.recommendations.push('Execute SQL functions script to create missing database functions');
    }
    if (!settingsOk) {
      validation.recommendations.push('Initialize academic settings with default values');
    }

    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString(),
      checked_by: req.admin.username
    });

  } catch (error) {
    console.error('❌ System validation error:', error);
    res.status(500).json({
      success: false,
      error: 'System validation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;