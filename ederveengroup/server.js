'use strict';

const path = require('path');

if (Number(process.versions.node.split('.')[0]) < 20) {
    console.error(`EderveenGroup needs Node.js 20 or newer (you have ${process.versions.node}). Get it free at https://nodejs.org/`);
    process.exit(1);
}

try {
    process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
    // no .env file; use the real environment
}

const { loadConfig } = require('./src/config');
const { createApp } = require('./src/app');

const config = loadConfig();
const { site, close } = createApp(config);

// redeploys stop the app with SIGTERM: finish writing to the database first
for (const sig of ['SIGTERM', 'SIGINT']) {
    process.once(sig, () => {
        const done = () => process.exit(0);
        Promise.race([close(), new Promise(r => setTimeout(r, 5000))]).then(done, done);
    });
}

site.listen(config.port, () => {
    const url = `http://localhost:${config.port}/`;
    console.log(`EderveenGroup is running at ${url}\n  Mail:    ${url}${config.baseUrl.slice(1)}\n  Profile: ${url}profile/\n  Also:    notes/, tasks/, contacts/, and admin/ for ADMIN_EMAILS\n  Storage: ${config.db ? `database ${config.db.database} on ${config.db.host}` : 'files in the data folder (set DB_HOST to use a database)'}`);
    if (config.openBrowser) openBrowser(url);
});

function openBrowser(url) {
    const { spawn } = require('child_process');
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try {
        spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    } catch {
        // no browser available; the URL is printed above
    }
}
