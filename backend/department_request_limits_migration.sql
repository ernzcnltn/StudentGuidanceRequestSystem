-- Migration script for department-based request limits
-- This table tracks when users last made requests to each department

CREATE TABLE IF NOT EXISTS department_request_limits (
    limit_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    department VARCHAR(100) NOT NULL,
    last_request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Unique constraint to ensure one record per student-department combination
    UNIQUE KEY unique_student_department (student_id, department),
    
    -- Index for performance
    INDEX idx_student_department (student_id, department),
    INDEX idx_last_request_time (last_request_time)
);

-- Add comments for clarity
ALTER TABLE department_request_limits 
COMMENT = 'Tracks the last request time for each student-department combination to enforce 24-hour cooldown';

ALTER TABLE department_request_limits 
MODIFY COLUMN student_id INT NOT NULL COMMENT 'Reference to the student who made the request',
MODIFY COLUMN department VARCHAR(100) NOT NULL COMMENT 'Department name (Accounting, Academic, Student Affairs, etc.)',
MODIFY COLUMN last_request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp of the last request made to this department';