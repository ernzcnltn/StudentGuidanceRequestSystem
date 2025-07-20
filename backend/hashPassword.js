const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  const hashed = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hashed: ${hashed}`);
  return hashed;
}

// Test şifrelerini hash'le
hashPassword('123456');