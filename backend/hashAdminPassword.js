const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function hashAdminPasswords() {
  try {
    // Test şifresi: "admin123"
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // admin_users tablosundaki şifreleri güncelle
    await pool.execute(
      'UPDATE admin_users SET password_hash = ?',
      [hashedPassword]
    );
    
    console.log('Admin passwords updated successfully!');
    console.log('Test login credentials:');
    console.log('Username: accounting_admin, Password: admin123');
    console.log('Username: academic_admin, Password: admin123');
    console.log('Username: dormitory_admin, Password: admin123');
    console.log('Username: student_affairs_admin, Password: admin123');
    console.log('Username: campus_services_admin, Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating admin passwords:', error);
    process.exit(1);
  }
}

hashAdminPasswords();