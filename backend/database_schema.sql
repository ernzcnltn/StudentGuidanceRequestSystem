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

-- 1. Roller tablosu
CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. İzinler tablosu
CREATE TABLE permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_system_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Rol-İzin ilişki tablosu
CREATE TABLE role_permissions (
    role_id INT,
    permission_id INT,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
);

-- 4. Kullanıcı-Rol ilişki tablosu
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
);

-- 5. Mevcut admin_users tablosuna RBAC desteği ekle
ALTER TABLE admin_users 
ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN last_role_update TIMESTAMP NULL,
ADD COLUMN role_updated_by INT NULL,
ADD FOREIGN KEY (role_updated_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL;

-- 6. İndeksler oluştur
CREATE INDEX idx_roles_active ON roles(is_active);
CREATE INDEX idx_roles_system ON roles(is_system_role);
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at);
CREATE INDEX idx_admin_users_super ON admin_users(is_super_admin);
CREATE INDEX idx_admin_users_department_active ON admin_users(department, is_active);

-- 7. Varsayılan rolleri ekle
INSERT INTO roles (role_name, display_name, description, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full system access and management capabilities', TRUE),
('department_admin', 'Department Administrator', 'Full access to own department with user management', TRUE),
('department_staff', 'Department Staff', 'Standard department access for processing requests', TRUE),
('read_only_admin', 'Read Only Administrator', 'View-only access to department data', TRUE),
('trainee_admin', 'Trainee Administrator', 'Limited access for training purposes', TRUE);

-- 8. Temel izinleri ekle
INSERT INTO permissions (permission_name, display_name, description, resource, action, is_system_permission) VALUES
-- Request Permissions
('requests.view_all', 'View All Requests', 'Can view requests from all departments', 'requests', 'view_all', TRUE),
('requests.view_department', 'View Department Requests', 'Can view requests from own department', 'requests', 'view_department', TRUE),
('requests.view_assigned', 'View Assigned Requests', 'Can view only assigned requests', 'requests', 'view_assigned', TRUE),
('requests.create', 'Create Requests', 'Can create new requests', 'requests', 'create', TRUE),
('requests.update_status', 'Update Request Status', 'Can change request status', 'requests', 'update_status', TRUE),
('requests.update_priority', 'Update Request Priority', 'Can change request priority', 'requests', 'update_priority', TRUE),
('requests.assign', 'Assign Requests', 'Can assign requests to other users', 'requests', 'assign', TRUE),
('requests.delete', 'Delete Requests', 'Can delete requests', 'requests', 'delete', TRUE),
('requests.export', 'Export Requests', 'Can export request data', 'requests', 'export', TRUE),

-- Response Permissions
('responses.create', 'Create Responses', 'Can add responses to requests', 'responses', 'create', TRUE),
('responses.update', 'Update Responses', 'Can edit existing responses', 'responses', 'update', TRUE),
('responses.delete', 'Delete Responses', 'Can delete responses', 'responses', 'delete', TRUE),
('responses.view_internal', 'View Internal Responses', 'Can view internal admin responses', 'responses', 'view_internal', TRUE),

-- User Management Permissions
('users.view', 'View Users', 'Can view user profiles', 'users', 'view', TRUE),
('users.create', 'Create Users', 'Can create new admin users', 'users', 'create', TRUE),
('users.update', 'Update Users', 'Can edit user profiles', 'users', 'update', TRUE),
('users.delete', 'Delete Users', 'Can delete admin users', 'users', 'delete', TRUE),
('users.manage_roles', 'Manage User Roles', 'Can assign/remove roles from users', 'users', 'manage_roles', TRUE),
('users.reset_password', 'Reset User Passwords', 'Can reset user passwords', 'users', 'reset_password', TRUE),

-- Analytics Permissions
('analytics.view_department', 'View Department Analytics', 'Can view own department analytics', 'analytics', 'view_department', TRUE),
('analytics.view_system', 'View System Analytics', 'Can view system-wide analytics', 'analytics', 'view_system', TRUE),
('analytics.export', 'Export Analytics', 'Can export analytics data', 'analytics', 'export', TRUE),

-- Settings Permissions
('settings.view', 'View Settings', 'Can view system settings', 'settings', 'view', TRUE),
('settings.update', 'Update Settings', 'Can modify system settings', 'settings', 'update', TRUE),
('settings.manage_request_types', 'Manage Request Types', 'Can create/edit/delete request types', 'settings', 'manage_request_types', TRUE),

-- Notification Permissions
('notifications.send', 'Send Notifications', 'Can send notifications to users', 'notifications', 'send', TRUE),
('notifications.manage', 'Manage Notifications', 'Can manage notification settings', 'notifications', 'manage', TRUE),

-- System Permissions
('system.backup', 'System Backup', 'Can create system backups', 'system', 'backup', TRUE),
('system.maintenance', 'System Maintenance', 'Can put system in maintenance mode', 'system', 'maintenance', TRUE),
('system.logs', 'View System Logs', 'Can view system logs', 'system', 'logs', TRUE);

-- 9. Rol-İzin atamaları
-- Super Admin - Tüm izinler
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'super_admin';

-- Department Admin - Departman yönetimi izinleri
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'department_admin'
AND p.permission_name IN (
    'requests.view_department', 'requests.create', 'requests.update_status', 
    'requests.update_priority', 'requests.assign', 'requests.export',
    'responses.create', 'responses.update', 'responses.delete', 'responses.view_internal',
    'users.view', 'users.create', 'users.update', 'users.manage_roles', 'users.reset_password',
    'analytics.view_department', 'analytics.export',
    'settings.view', 'settings.manage_request_types',
    'notifications.send', 'notifications.manage'
);

-- Department Staff - Standart çalışan izinleri
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'department_staff'
AND p.permission_name IN (
    'requests.view_department', 'requests.create', 'requests.update_status',
    'responses.create', 'responses.update',
    'analytics.view_department',
    'settings.view',
    'notifications.send'
);

-- Read Only Admin - Sadece görüntüleme izinleri
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'read_only_admin'
AND p.permission_name IN (
    'requests.view_department',
    'analytics.view_department',
    'settings.view'
);

-- Trainee Admin - Sınırlı izinler
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'trainee_admin'
AND p.permission_name IN (
    'requests.view_assigned', 'requests.update_status',
    'responses.create',
    'settings.view'
);

-- 10. Mevcut admin kullanıcılarına varsayılan roller ata
-- Super admin rolü oluştur
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT au.admin_id, r.role_id, 1
FROM admin_users au, roles r
WHERE r.role_name = 'department_admin'
AND au.is_active = TRUE;

-- İlk admin'i super admin yap (eğer varsa)
UPDATE admin_users 
SET is_super_admin = TRUE 
WHERE admin_id = 1 OR username = 'accounting_admin'
LIMIT 1;

-- Super admin kullanıcısına super admin rolü ver
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT au.admin_id, r.role_id, au.admin_id
FROM admin_users au, roles r
WHERE r.role_name = 'super_admin'
AND au.is_super_admin = TRUE
ON DUPLICATE KEY UPDATE assigned_at = NOW();

-- 11. Trigger'lar oluştur (Opsiyonel)
DELIMITER //

CREATE TRIGGER update_role_timestamp
BEFORE UPDATE ON user_roles
FOR EACH ROW
BEGIN
    IF NEW.role_id != OLD.role_id OR NEW.is_active != OLD.is_active THEN
        UPDATE admin_users 
        SET last_role_update = NOW()
        WHERE admin_id = NEW.user_id;
    END IF;
END//

DELIMITER ;

-- 12. Verification Queries (Test için)
-- Rolleri ve izin sayılarını göster
SELECT 
    r.role_name,
    r.display_name,
    COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
GROUP BY r.role_id, r.role_name, r.display_name
ORDER BY r.role_name;

-- Her kullanıcının rollerini göster
SELECT 
    au.username,
    au.department,
    r.role_name,
    ur.assigned_at,
    ur.is_active
FROM admin_users au
LEFT JOIN user_roles ur ON au.admin_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
WHERE au.is_active = TRUE
ORDER BY au.username, r.role_name;