// backend/middleware/departmentCooldown.js
const { pool } = require('../config/database');

// Middleware to check department cooldown before allowing request creation
const checkDepartmentCooldown = async (req, res, next) => {
  try {
    const { type_id } = req.body;
    const studentId = req.student.student_id || req.student.studentId;

    // First get the department/category for this request type
    const [requestTypeResult] = await pool.execute(
      'SELECT category FROM request_types WHERE type_id = ?',
      [type_id]
    );

    if (requestTypeResult.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type'
      });
    }

    const department = requestTypeResult[0].category;

    // Check if student has made a request to this department in the last 24 hours
    const query = `
      SELECT 
        last_request_time,
        TIMESTAMPDIFF(HOUR, last_request_time, NOW()) as hours_since_last_request
      FROM department_request_limits 
      WHERE student_id = ? AND department = ?
    `;

    const [rows] = await pool.execute(query, [studentId, department]);

    if (rows.length > 0) {
      const hoursSinceLastRequest = rows[0].hours_since_last_request;
      
      if (hoursSinceLastRequest < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastRequest);
        const nextAvailableTime = new Date(new Date(rows[0].last_request_time).getTime() + 24 * 60 * 60 * 1000);
        
        return res.status(429).json({
          success: false,
          error: `Department cooldown active. You must wait ${hoursRemaining} more hours before making another request to ${department} department.`,
          cooldown: {
            department,
            hoursRemaining,
            lastRequestTime: rows[0].last_request_time,
            nextAvailableTime: nextAvailableTime.toISOString()
          }
        });
      }
    }

    // Store department info in request for later use
    req.departmentInfo = {
      department,
      studentId
    };

    next();
  } catch (error) {
    console.error('Error checking department cooldown:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check department availability'
    });
  }
};

// Function to record department request after successful creation
const recordDepartmentRequest = async (studentId, department) => {
  try {
    const query = `
      INSERT INTO department_request_limits (student_id, department, last_request_time)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        last_request_time = NOW(),
        updated_at = NOW()
    `;

    await pool.execute(query, [studentId, department]);
    console.log(`✅ Recorded department request: Student ${studentId} -> ${department} department`);
    return { success: true };
  } catch (error) {
    console.error('Error recording department request:', error);
    return { success: false, error: error.message };
  }
};

// Function to check availability for a specific department (helper function)
const checkDepartmentAvailability = async (studentId, department) => {
  try {
    const query = `
      SELECT 
        last_request_time,
        TIMESTAMPDIFF(HOUR, last_request_time, NOW()) as hours_since_last_request
      FROM department_request_limits 
      WHERE student_id = ? AND department = ?
    `;

    const [rows] = await pool.execute(query, [studentId, department]);

    if (rows.length === 0) {
      return {
        available: true,
        hoursRemaining: 0,
        lastRequestTime: null,
        nextAvailableTime: null
      };
    }

    const hoursSinceLastRequest = rows[0].hours_since_last_request;
    
    if (hoursSinceLastRequest >= 24) {
      return {
        available: true,
        hoursRemaining: 0,
        lastRequestTime: rows[0].last_request_time,
        nextAvailableTime: null
      };
    } else {
      const hoursRemaining = 24 - hoursSinceLastRequest;
      const nextAvailableTime = new Date(new Date(rows[0].last_request_time).getTime() + 24 * 60 * 60 * 1000);
      
      return {
        available: false,
        hoursRemaining: Math.ceil(hoursRemaining),
        lastRequestTime: rows[0].last_request_time,
        nextAvailableTime: nextAvailableTime.toISOString()
      };
    }
  } catch (error) {
    console.error('Error checking department availability:', error);
    return {
      available: false,
      error: error.message
    };
  }
};

module.exports = {
  checkDepartmentCooldown,
  recordDepartmentRequest,
  checkDepartmentAvailability
};