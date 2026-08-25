const config = require('./config');
const createApp = require('./web/app');

const app = createApp();
app.listen(config.port, () => {
  console.log(`VPS dashboard listening on http://0.0.0.0:${config.port}`);
});
