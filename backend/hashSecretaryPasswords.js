const bcrypt = require('bcrypt');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

const generateHashes = async () => {
  const password = 'secretary123'; // Default password for all
  const hash = await hashPassword(password);
  console.log('Password Hash:', hash);
};

generateHashes();