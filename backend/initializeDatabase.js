const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('🔧 Initializing FIU Guidance System Database...');
  
  try {
    // 1. Create tables from schema file
    const schemaPath = path.join(__dirname, 'database_schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.execute(statement);
        }
      }
      console.log('✅ Database schema created successfully');
    }

    // 2. Hash passwords and update admin users
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.execute(`
      UPDATE admin_users 
      SET password_hash = ? 
      WHERE password_hash = '$2a$10$hash_placeholder'
    `, [hashedPassword]);

    // 3. Create test student with hashed password
    const studentPassword = await bcrypt.hash('123456', 10);
    
    await pool.execute(`
      UPDATE students 
      SET password = ? 
      WHERE password = '$2a$10$hash_placeholder'
    `, [studentPassword]);

    // 4. Verify data
    const [adminCount] = await pool.execute('SELECT COUNT(*) as count FROM admin_users');
    const [typeCount] = await pool.execute('SELECT COUNT(*) as count FROM request_types');
    const [studentCount] = await pool.execute('SELECT COUNT(*) as count FROM students');

    console.log('📊 Database Statistics:');
    console.log(`   - Admin Users: ${adminCount[0].count}`);
    console.log(`   - Request Types: ${typeCount[0].count}`);
    console.log(`   - Students: ${studentCount[0].count}`);

    console.log('\n🎯 Test Accounts Created:');
    console.log('📚 Student Account:');
    console.log('   Student Number: 20210001');
    console.log('   Password: 123456');
    
    console.log('\n👨‍💼 Admin Accounts (all use password: admin123):');
    console.log('   - accounting_admin (Accounting Department)');
    console.log('   - academic_admin (Academic Department)');
    console.log('   - dormitory_admin (Dormitory Department)');
    console.log('   - student_affairs_admin (Student Affairs Department)');
    console.log('   - campus_services_admin (Campus Services Department)');

    console.log('\n✅ Database initialization completed successfully!');
    console.log('🚀 You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Check if database exists and is empty
async function checkAndInitialize() {
  try {
    const [tables] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'students'
    `);

    if (tables[0].count === 0) {
      console.log('📋 Database is empty, initializing...');
      await initializeDatabase();
    } else {
      console.log('✅ Database already exists');
      
      // Check if we need to update passwords
      const [adminCheck] = await pool.execute(`
        SELECT COUNT(*) as count 
        FROM admin_users 
        WHERE password_hash = '$2a$10$hash_placeholder'
      `);

      if (adminCheck[0].count > 0) {
        console.log('🔑 Updating admin passwords...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.execute(`
          UPDATE admin_users 
          SET password_hash = ? 
          WHERE password_hash = '$2a$10$hash_placeholder'
        `, [hashedPassword]);
        console.log('✅ Admin passwords updated');
      }

      const [studentCheck] = await pool.execute(`
        SELECT COUNT(*) as count 
        FROM students 
        WHERE password = '$2a$10$hash_placeholder'
      `);

      if (studentCheck[0].count > 0) {
        console.log('🔑 Updating student passwords...');
        const studentPassword = await bcrypt.hash('123456', 10);
        await pool.execute(`
          UPDATE students 
          SET password = ? 
          WHERE password = '$2a$10$hash_placeholder'
        `, [studentPassword]);
        console.log('✅ Student passwords updated');
      }

      console.log('🎯 Ready to use!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Database check failed:', error);
    console.log('\n💡 Make sure MySQL is running and database "fiu_guidance_db" exists');
    console.log('   Create database with: CREATE DATABASE fiu_guidance_db;');
    process.exit(1);
  }
}

checkAndInitialize();