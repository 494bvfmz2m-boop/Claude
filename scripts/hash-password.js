#!/usr/bin/env node
// Generates a bcrypt hash for DASHBOARD_ADMIN_PASSWORD_HASH in .env.
// Usage: npm run hash-password -- "your-password"
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Choose a password with at least 8 characters.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nAdd this to your .env file:\n');
console.log(`DASHBOARD_ADMIN_PASSWORD_HASH=${hash}\n`);
