// backend/forceResetDatabase.js - FORCE RESET VERSION
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create connection pool specifically for fiu_guidance_db
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'cilo1536',
  database: 'fiu_guidance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create connection pool for system queries
const systemPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'cilo1536',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function forceResetDatabase() {
  console.log('💥 FORCE Resetting FIU Guidance System Database...');
  
  try {
    // 1. Check if database exists
    console.log('🔍 Checking database...');
    const [databases] = await systemPool.execute('SHOW DATABASES LIKE "fiu_guidance_db"');
    
    if (databases.length === 0) {
      console.log('❌ Database does not exist, creating...');
      await systemPool.execute('CREATE DATABASE fiu_guidance_db');
      console.log('✅ Database created');
    }

    // 2. FORCE DROP THE ENTIRE DATABASE AND RECREATE
    console.log('💣 Dropping entire database...');
    await systemPool.execute('DROP DATABASE IF EXISTS fiu_guidance_db');
    console.log('✅ Database dropped');

    console.log('🏗️ Creating fresh database...');
    await systemPool.execute('CREATE DATABASE fiu_guidance_db');
    console.log('✅ Fresh database created');

    // 3. Now work with the fresh database
    const freshPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'cilo1536',
      database: 'fiu_guidance_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 4. Create all tables from scratch
    console.log('📋 Creating fresh tables...');
    
    // Create request_types table
    await freshPool.execute(`
      CREATE TABLE request_types (
          type_id INT AUTO_INCREMENT PRIMARY KEY,
          category VARCHAR(100) NOT NULL,
          type_name VARCHAR(255) NOT NULL,
          description_en TEXT,
          is_document_required BOOLEAN DEFAULT FALSE,
          is_disabled BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Created table: request_types');

    // Create students table
    await freshPool.execute(`
      CREATE TABLE students (
          student_id INT AUTO_INCREMENT PRIMARY KEY,
          student_number VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          program VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Created table: students');

    // Create admin_users table
    await freshPool.execute(`
      CREATE TABLE admin_users (
          admin_id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          name VARCHAR(255),
          email VARCHAR(255),
          department VARCHAR(100) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Created table: admin_users');

    // Create guidance_requests table
    await freshPool.execute(`
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
      )
    `);
    console.log('   ✅ Created table: guidance_requests');

    // Create attachments table
    await freshPool.execute(`
      CREATE TABLE attachments (
          attachment_id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_type VARCHAR(100),
          file_size INT,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES guidance_requests(request_id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ Created table: attachments');

    // Create admin_responses table
    await freshPool.execute(`
      CREATE TABLE admin_responses (
          response_id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          admin_id INT,
          response_content TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES guidance_requests(request_id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL
      )
    `);
    console.log('   ✅ Created table: admin_responses');

    // 5. Insert request types
    console.log('📝 Inserting request types...');
    const requestTypes = [
      // Accounting Department
      ['Accounting', 'Payment Issues', 'Problems with tuition payments, refunds, or billing', false],
      ['Accounting', 'Financial Aid Support', 'Assistance with scholarships, grants, and financial aid applications', true],
      ['Accounting', 'Receipt Requests', 'Request for payment receipts and financial documents', false],
      ['Accounting', 'Installment Plan Setup', 'Setting up payment plans for tuition fees', true],
      ['Accounting', 'Refund Requests', 'Request for tuition or fee refunds', true],

      // Academic Department  
      ['Academic', 'Course Registration Problems', 'Issues with course enrollment, prerequisites, or scheduling conflicts', false],
      ['Academic', 'Grade Appeals', 'Formal appeals for grade reviews and corrections', true],
      ['Academic', 'Transcript Requests', 'Official and unofficial transcript requests', false],
      ['Academic', 'Academic Probation Support', 'Guidance for students on academic probation', false],
      ['Academic', 'Course Withdrawal', 'Requests for course or semester withdrawal', true],
      ['Academic', 'Credit Transfer Evaluation', 'Evaluation of transfer credits from other institutions', true],
      ['Academic', 'Graduation Requirements Check', 'Verification of graduation requirements completion', false],

      // Student Affairs Department
      ['Student Affairs', 'Student ID Issues', 'Problems with student ID cards, replacements, or updates', false],
      ['Student Affairs', 'Campus Event Participation', 'Registration and information about campus events and activities', false],
      ['Student Affairs', 'Student Organization Support', 'Assistance with student clubs and organization matters', false],
      ['Student Affairs', 'Disciplinary Appeals', 'Appeals for disciplinary actions and academic misconduct', true],
      ['Student Affairs', 'Emergency Support', 'Emergency financial or personal support requests', true],
      ['Student Affairs', 'Mental Health Resources', 'Access to counseling and mental health support services', false],

      // Dormitory Department
      ['Dormitory', 'Room Assignment Issues', 'Problems with dormitory room assignments or changes', false],
      ['Dormitory', 'Maintenance Requests', 'Reporting maintenance issues in dormitory facilities', false],
      ['Dormitory', 'Roommate Conflicts', 'Mediation and support for roommate-related issues', false],
      ['Dormitory', 'Key Replacement', 'Replacement of lost or damaged dormitory keys', true],
      ['Dormitory', 'Contract Termination', 'Early termination of dormitory housing contracts', true],
      ['Dormitory', 'Facility Complaints', 'Complaints about dormitory facilities and services', false],

      // Campus Services Department
      ['Campus Services', 'IT Support Requests', 'Computer, network, and technology-related support', false],
      ['Campus Services', 'Library Access Issues', 'Problems with library access, resources, or services', false],
      ['Campus Services', 'Parking Permits', 'Applications and issues related to campus parking permits', true],
      ['Campus Services', 'Campus Security Concerns', 'Reporting security incidents or safety concerns', false],
      ['Campus Services', 'Facility Booking', 'Reservations for campus facilities and meeting rooms', false],
      ['Campus Services', 'Lost and Found', 'Reporting or claiming lost items on campus', false]
    ];

    for (const [category, type_name, description_en, is_document_required] of requestTypes) {
      await freshPool.execute(
        'INSERT INTO request_types (category, type_name, description_en, is_document_required) VALUES (?, ?, ?, ?)',
        [category, type_name, description_en, is_document_required]
      );
    }
    console.log(`   ✅ Inserted ${requestTypes.length} request types`);

    // 6. Insert admin users
    console.log('👨‍💼 Creating admin users...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    const adminUsers = [
      ['accounting_admin', 'Accounting Administrator', 'Accounting Admin', 'accounting@fiu.edu.tr', 'Accounting'],
      ['academic_admin', 'Academic Administrator', 'Academic Admin', 'academic@fiu.edu.tr', 'Academic'],
      ['student_affairs_admin', 'Student Affairs Administrator', 'Student Affairs Admin', 'studentaffairs@fiu.edu.tr', 'Student Affairs'],
      ['dormitory_admin', 'Dormitory Administrator', 'Dormitory Admin', 'dormitory@fiu.edu.tr', 'Dormitory'],
      ['campus_services_admin', 'Campus Services Administrator', 'Campus Services Admin', 'campusservices@fiu.edu.tr', 'Campus Services']
    ];

    for (const [username, full_name, name, email, department] of adminUsers) {
      await freshPool.execute(
        'INSERT INTO admin_users (username, password_hash, full_name, name, email, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, adminPassword, full_name, name, email, department, 'admin']
      );
    }
    console.log(`   ✅ Created ${adminUsers.length} admin users`);

    // 7. Insert test student
    console.log('👨‍🎓 Creating test student...');
    const studentPassword = await bcrypt.hash('123456', 10);
    
    await freshPool.execute(
      'INSERT INTO students (student_number, name, email, password, program) VALUES (?, ?, ?, ?, ?)',
      ['20210001', 'Test Student', 'test@fiu.edu.tr', studentPassword, 'Computer Engineering']
    );
    console.log('   ✅ Created test student');

    // 8. Create indexes
    console.log('🔗 Creating indexes...');
    const indexes = [
      'CREATE INDEX idx_requests_student_id ON guidance_requests(student_id)',
      'CREATE INDEX idx_requests_type_id ON guidance_requests(type_id)',
      'CREATE INDEX idx_requests_status ON guidance_requests(status)',
      'CREATE INDEX idx_requests_priority ON guidance_requests(priority)',
      'CREATE INDEX idx_requests_submitted_at ON guidance_requests(submitted_at)',
      'CREATE INDEX idx_attachments_request_id ON attachments(request_id)',
      'CREATE INDEX idx_admin_responses_request_id ON admin_responses(request_id)',
      'CREATE INDEX idx_admin_responses_admin_id ON admin_responses(admin_id)',
      'CREATE INDEX idx_request_types_category ON request_types(category)',
      'CREATE INDEX idx_admin_users_department ON admin_users(department)',
      'CREATE INDEX idx_students_student_number ON students(student_number)',
      'CREATE INDEX idx_students_email ON students(email)'
    ];

    for (const indexSql of indexes) {
      try {
        await freshPool.execute(indexSql);
      } catch (error) {
        console.log(`   ⚠️ Index warning: ${error.message}`);
      }
    }
    console.log('   ✅ Created performance indexes');

    // 9. Final verification
    const [verification] = await freshPool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM admin_users) as admin_count,
        (SELECT COUNT(*) FROM students) as student_count,
        (SELECT COUNT(*) FROM request_types) as type_count,
        (SELECT COUNT(*) FROM guidance_requests) as request_count,
        (SELECT COUNT(*) FROM attachments) as attachment_count,
        (SELECT COUNT(*) FROM admin_responses) as response_count
    `);

    // Show all tables
    const [tables] = await freshPool.execute('SHOW TABLES');
    console.log('\n📋 Created Tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   ✅ ${tableName}`);
    });

    console.log('\n📊 Database FORCE Reset Complete!');
    console.log('=================================');
    console.log('Table Counts:');
    console.log(`   👨‍💼 Admin Users: ${verification[0].admin_count}`);
    console.log(`   👨‍🎓 Students: ${verification[0].student_count}`);
    console.log(`   📋 Request Types: ${verification[0].type_count}`);
    console.log(`   📝 Requests: ${verification[0].request_count}`);
    console.log(`   📎 Attachments: ${verification[0].attachment_count}`);
    console.log(`   💬 Responses: ${verification[0].response_count}`);

    console.log('\n🎯 Test Accounts:');
    console.log('📚 Student Account:');
    console.log('   Student Number: 20210001');
    console.log('   Password: 123456');
    
    console.log('\n👨‍💼 Admin Accounts (password: admin123):');
    console.log('   - accounting_admin (Accounting Department)');
    console.log('   - academic_admin (Academic Department)');
    console.log('   - dormitory_admin (Dormitory Department)');
    console.log('   - student_affairs_admin (Student Affairs Department)');
    console.log('   - campus_services_admin (Campus Services Department)');

    console.log('\n✅ Database is completely fresh and ready!');
    console.log('🚀 Run: npm run dev');

    await freshPool.end();

  } catch (error) {
    console.error('❌ Force reset failed:', error);
    throw error;
  } finally {
    await systemPool.end();
    process.exit(0);
  }
}

// Main execution
async function main() {
  try {
    await forceResetDatabase();
  } catch (error) {
    console.error('❌ Process failed:', error);
    console.log('\n💡 Make sure:');
    console.log('   - MySQL is running');
    console.log('   - Database credentials are correct in .env file');
    console.log('   - User has DROP/CREATE privileges');
    process.exit(1);
  }
}

main();