-- FIU Student Guidance System Database Schema
-- Drop existing tables if they exist (for fresh installation)
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS admin_responses;  
DROP TABLE IF EXISTS guidance_requests;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS request_types;

-- Create request_types table
CREATE TABLE request_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    type_name VARCHAR(255) NOT NULL,
    description_en TEXT,
    is_document_required BOOLEAN DEFAULT FALSE,
    is_disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create students table
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    program VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create admin_users table
CREATE TABLE admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    name VARCHAR(255), -- for compatibility
    email VARCHAR(255),
    department VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create guidance_requests table
CREATE TABLE guidance_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    type_id INT NOT NULL,
    content TEXT NOT NULL,
    priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    status ENUM('Pending', 'Informed', 'Completed') DEFAULT 'Pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES request_types(type_id) ON DELETE CASCADE
);

-- Create attachments table
CREATE TABLE attachments (
    attachment_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES guidance_requests(request_id) ON DELETE CASCADE
);

-- Create admin_responses table
CREATE TABLE admin_responses (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    admin_id INT,
    response_content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES guidance_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL
);

-- Insert request types
INSERT INTO request_types (category, type_name, description_en, is_document_required) VALUES
-- Accounting Department
('Accounting', 'Payment Issues', 'Problems with tuition payments, refunds, or billing', FALSE),
('Accounting', 'Financial Aid Support', 'Assistance with scholarships, grants, and financial aid applications', TRUE),
('Accounting', 'Receipt Requests', 'Request for payment receipts and financial documents', FALSE),
('Accounting', 'Installment Plan Setup', 'Setting up payment plans for tuition fees', TRUE),
('Accounting', 'Refund Requests', 'Request for tuition or fee refunds', TRUE),

-- Academic Department  
('Academic', 'Course Registration Problems', 'Issues with course enrollment, prerequisites, or scheduling conflicts', FALSE),
('Academic', 'Grade Appeals', 'Formal appeals for grade reviews and corrections', TRUE),
('Academic', 'Transcript Requests', 'Official and unofficial transcript requests', FALSE),
('Academic', 'Academic Probation Support', 'Guidance for students on academic probation', FALSE),
('Academic', 'Course Withdrawal', 'Requests for course or semester withdrawal', TRUE),
('Academic', 'Credit Transfer Evaluation', 'Evaluation of transfer credits from other institutions', TRUE),
('Academic', 'Graduation Requirements Check', 'Verification of graduation requirements completion', FALSE),

-- Student Affairs Department
('Student Affairs', 'Student ID Issues', 'Problems with student ID cards, replacements, or updates', FALSE),
('Student Affairs', 'Campus Event Participation', 'Registration and information about campus events and activities', FALSE),
('Student Affairs', 'Student Organization Support', 'Assistance with student clubs and organization matters', FALSE),
('Student Affairs', 'Disciplinary Appeals', 'Appeals for disciplinary actions and academic misconduct', TRUE),
('Student Affairs', 'Emergency Support', 'Emergency financial or personal support requests', TRUE),
('Student Affairs', 'Mental Health Resources', 'Access to counseling and mental health support services', FALSE),

-- Dormitory Department
('Dormitory', 'Room Assignment Issues', 'Problems with dormitory room assignments or changes', FALSE),
('Dormitory', 'Maintenance Requests', 'Reporting maintenance issues in dormitory facilities', FALSE),
('Dormitory', 'Roommate Conflicts', 'Mediation and support for roommate-related issues', FALSE),
('Dormitory', 'Key Replacement', 'Replacement of lost or damaged dormitory keys', TRUE),
('Dormitory', 'Contract Termination', 'Early termination of dormitory housing contracts', TRUE),
('Dormitory', 'Facility Complaints', 'Complaints about dormitory facilities and services', FALSE),

-- Campus Services Department
('Campus Services', 'IT Support Requests', 'Computer, network, and technology-related support', FALSE),
('Campus Services', 'Library Access Issues', 'Problems with library access, resources, or services', FALSE),
('Campus Services', 'Parking Permits', 'Applications and issues related to campus parking permits', TRUE),
('Campus Services', 'Campus Security Concerns', 'Reporting security incidents or safety concerns', FALSE),
('Campus Services', 'Facility Booking', 'Reservations for campus facilities and meeting rooms', FALSE),
('Campus Services', 'Lost and Found', 'Reporting or claiming lost items on campus', FALSE);

-- Insert admin users with placeholder password hashes (will be updated by initialization script)
INSERT INTO admin_users (username, password_hash, full_name, name, email, department, role) VALUES
('accounting_admin', '$2a$10$hash_placeholder', 'Accounting Administrator', 'Accounting Admin', 'accounting@fiu.edu.tr', 'Accounting', 'admin'),
('academic_admin', '$2a$10$hash_placeholder', 'Academic Administrator', 'Academic Admin', 'academic@fiu.edu.tr', 'Academic', 'admin'),
('student_affairs_admin', '$2a$10$hash_placeholder', 'Student Affairs Administrator', 'Student Affairs Admin', 'studentaffairs@fiu.edu.tr', 'Student Affairs', 'admin'),
('dormitory_admin', '$2a$10$hash_placeholder', 'Dormitory Administrator', 'Dormitory Admin', 'dormitory@fiu.edu.tr', 'Dormitory', 'admin'),
('campus_services_admin', '$2a$10$hash_placeholder', 'Campus Services Administrator', 'Campus Services Admin', 'campusservices@fiu.edu.tr', 'Campus Services', 'admin');

-- Insert test student with placeholder password hash (will be updated by initialization script)
INSERT INTO students (student_number, name, email, password, program) VALUES
('20210001', 'Test Student', 'test@fiu.edu.tr', '$2a$10$hash_placeholder', 'Computer Engineering');

-- Create indexes for better performance
CREATE INDEX idx_requests_student_id ON guidance_requests(student_id);
CREATE INDEX idx_requests_type_id ON guidance_requests(type_id);
CREATE INDEX idx_requests_status ON guidance_requests(status);
CREATE INDEX idx_requests_priority ON guidance_requests(priority);
CREATE INDEX idx_requests_submitted_at ON guidance_requests(submitted_at);
CREATE INDEX idx_attachments_request_id ON attachments(request_id);
CREATE INDEX idx_admin_responses_request_id ON admin_responses(request_id);
CREATE INDEX idx_admin_responses_admin_id ON admin_responses(admin_id);
CREATE INDEX idx_request_types_category ON request_types(category);
CREATE INDEX idx_admin_users_department ON admin_users(department);
CREATE INDEX idx_students_student_number ON students(student_number);
CREATE INDEX idx_students_email ON students(email);