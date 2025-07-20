const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function createTestStudent() {
  try {
    // Test şifresi hash'le
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // Test student ekle
    await pool.execute(
      'INSERT INTO students (student_number, name, email, password, program) VALUES (?, ?, ?, ?, ?)',
      ['20210001', 'Test Student', 'test@fiu.edu.tr', hashedPassword, 'Computer Engineering']
    );
    
    console.log('✅ Test student created successfully!');
    console.log('Login: 20210001 / 123456');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test student:', error);
    process.exit(1);
  }
}

createTestStudent();