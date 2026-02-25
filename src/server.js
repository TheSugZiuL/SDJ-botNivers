const { app, config, startBackgroundServices } = require("./app");

app.listen(config.port, () => {
  console.log(`[HTTP] Painel em http://localhost:${config.port}`);
  startBackgroundServices();
});
