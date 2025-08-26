// backend/routes/departmentLimits.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');

// Student auth middleware
const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.student = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// GET /api/department-limits/availability/:department
// Check if student can make a request to a specific department
router.get('/availability/:department', authenticateStudent, async (req, res) => {
  try {
    const { department } = req.params;
    const studentId = req.student.studentId;

    // Validate department parameter
    const validDepartments = ['Accounting', 'Academic', 'Student Affairs', 'Dormitory', 'Campus Services'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department. Valid departments: ' + validDepartments.join(', ')
      });
    }

    // Check the last request time for this student-department combination
    const query = `
      SELECT 
        last_request_time,
        TIMESTAMPDIFF(HOUR, last_request_time, NOW()) as hours_since_last_request
      FROM department_request_limits 
      WHERE student_id = ? AND department = ?
    `;

    const [rows] = await pool.execute(query, [studentId, department]);

    let canMakeRequest = true;
    let hoursRemaining = 0;
    let lastRequestTime = null;

    if (rows.length > 0) {
      const hoursSinceLastRequest = rows[0].hours_since_last_request;
      lastRequestTime = rows[0].last_request_time;
      
      if (hoursSinceLastRequest < 24) {
        canMakeRequest = false;
        hoursRemaining = 24 - hoursSinceLastRequest;
      }
    }

    res.json({
      success: true,
      data: {
        department,
        canMakeRequest,
        hoursRemaining: Math.ceil(hoursRemaining),
        lastRequestTime,
        nextAvailableTime: lastRequestTime ? 
          new Date(new Date(lastRequestTime).getTime() + 24 * 60 * 60 * 1000) : null
      }
    });

  } catch (error) {
    console.error('Error checking department availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check department availability'
    });
  }
});

// GET /api/department-limits/availability
// Check availability for all departments for the current student
router.get('/availability', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const departments = ['Accounting', 'Academic', 'Student Affairs', 'Dormitory', 'Campus Services'];

    // Get last request times for all departments
    const query = `
      SELECT 
        department,
        last_request_time,
        TIMESTAMPDIFF(HOUR, last_request_time, NOW()) as hours_since_last_request
      FROM department_request_limits 
      WHERE student_id = ?
    `;

    const [rows] = await pool.execute(query, [studentId]);

    // Create availability status for each department
    const departmentAvailability = departments.map(department => {
      const departmentData = rows.find(row => row.department === department);
      
      let canMakeRequest = true;
      let hoursRemaining = 0;
      let lastRequestTime = null;

      if (departmentData) {
        const hoursSinceLastRequest = departmentData.hours_since_last_request;
        lastRequestTime = departmentData.last_request_time;
        
        if (hoursSinceLastRequest < 24) {
          canMakeRequest = false;
          hoursRemaining = 24 - hoursSinceLastRequest;
        }
      }

      return {
        department,
        canMakeRequest,
        hoursRemaining: Math.ceil(hoursRemaining),
        lastRequestTime,
        nextAvailableTime: lastRequestTime ? 
          new Date(new Date(lastRequestTime).getTime() + 24 * 60 * 60 * 1000) : null
      };
    });

    res.json({
      success: true,
      data: departmentAvailability
    });

  } catch (error) {
    console.error('Error checking all departments availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check departments availability'
    });
  }
});

// POST /api/department-limits/record-request
// Record a new request for department limit tracking (called internally)
async function recordDepartmentRequest(studentId, department) {
  try {
    const query = `
      INSERT INTO department_request_limits (student_id, department, last_request_time)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        last_request_time = NOW(),
        updated_at = NOW()
    `;

    await pool.execute(query, [studentId, department]);
    return { success: true };
  } catch (error) {
    console.error('Error recording department request:', error);
    return { success: false, error: error.message };
  }
}

// Function to check if a department request is allowed
async function checkDepartmentRequestAllowed(studentId, department) {
  try {
    const query = `
      SELECT 
        TIMESTAMPDIFF(HOUR, last_request_time, NOW()) as hours_since_last_request
      FROM department_request_limits 
      WHERE student_id = ? AND department = ?
    `;

    const [rows] = await pool.execute(query, [studentId, department]);

    if (rows.length === 0) {
      // No previous request to this department, allowed
      return { allowed: true, hoursRemaining: 0 };
    }

    const hoursSinceLastRequest = rows[0].hours_since_last_request;
    
    if (hoursSinceLastRequest >= 24) {
      return { allowed: true, hoursRemaining: 0 };
    } else {
      const hoursRemaining = 24 - hoursSinceLastRequest;
      return { 
        allowed: false, 
        hoursRemaining: Math.ceil(hoursRemaining),
        message: `You must wait ${Math.ceil(hoursRemaining)} more hours before making another request to ${department} department.`
      };
    }
  } catch (error) {
    console.error('Error checking department request allowance:', error);
    return { allowed: false, error: error.message };
  }
}

// POST /api/department-limits/reset/:department (Admin only - for testing)
router.post('/reset/:department', authenticateStudent, async (req, res) => {
  try {
    const { department } = req.params;
    const studentId = req.student.studentId;

    // Delete the record to reset the cooldown (for testing purposes)
    const query = `
      DELETE FROM department_request_limits 
      WHERE student_id = ? AND department = ?
    `;

    await pool.execute(query, [studentId, department]);

    res.json({
      success: true,
      message: `Reset cooldown for ${department} department`
    });

  } catch (error) {
    console.error('Error resetting department cooldown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset department cooldown'
    });
  }
});

// Export functions for use in other modules
module.exports = router;
module.exports.recordDepartmentRequest = recordDepartmentRequest;
module.exports.checkDepartmentRequestAllowed = checkDepartmentRequestAllowed;