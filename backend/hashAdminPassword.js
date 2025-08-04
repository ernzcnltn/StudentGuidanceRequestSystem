const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function hashAdminPasswords() {
  try {
    // Normal adminler için şifre: "admin123"
    const normalAdminPassword = await bcrypt.hash('admin123', 10);
    
    // Super admin için güçlü şifre: "SuperAdmin2024!"
    const superAdminPassword = await bcrypt.hash('SuperAdmin2024!', 10);
    
    // Normal admin şifrelerini güncelle (superadmin hariç)
    await pool.execute(
      'UPDATE admin_users SET password_hash = ? WHERE username != ?',
      [normalAdminPassword, 'superadmin']
    );
    
    // Super admin şifresini güncelle
    await pool.execute(
      'UPDATE admin_users SET password_hash = ? WHERE username = ?',
      [superAdminPassword, 'superadmin']
    );
    
    console.log('✅ Admin passwords updated successfully!');
    console.log('');
    console.log('🔑 Department Admin Login Credentials:');
    console.log('Username: accounting_admin, Password: admin123');
    console.log('Username: academic_admin, Password: admin123');
    console.log('Username: dormitory_admin, Password: admin123');
    console.log('Username: student_affairs_admin, Password: admin123');
    console.log('Username: campus_services_admin, Password: admin123');
    console.log('');
    console.log('🔥 Super Admin Login Credentials:');
    console.log('Username: superadmin, Password: SuperAdmin2024!');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the super admin password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin passwords:', error);
    process.exit(1);
  }
}

hashAdminPasswords();