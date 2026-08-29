const readline = require('node:readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter a password to hash for DASHBOARD_PASSWORD_HASH: ', (password) => {
  const hash = bcrypt.hashSync(password, 10);
  console.log('\nAdd this line to your .env file:\n');
  console.log(`DASHBOARD_PASSWORD_HASH=${hash}\n`);
  rl.close();
});
