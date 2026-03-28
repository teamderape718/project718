/**
 * PM2 — depuis la racine du projet : pm2 start deploy/ecosystem.config.cjs
 * Prérequis : .env rempli, npm install, npm run web:build, npm run db:migrate
 */
const path = require("path");
const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "qcfa-api",
      cwd: root,
      script: "npx",
      args: "tsx src/server.ts",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "qcfa-bot",
      cwd: root,
      script: "npx",
      args: "tsx src/telegram/bot.ts",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
