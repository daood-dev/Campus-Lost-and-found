const { createApp } = require('./app');
const { init } = require('./config/db');

init();
const port = process.env.PORT || 3000;
createApp().listen(port, () => console.log(`Campus Lost & Found running at http://localhost:${port}`));
