// Reads the .env file and gives every setting a default.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env");

// Each line looks like NAME=value. Lines starting with # are skipped.
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    const equals = trimmed.indexOf("=");
    if (trimmed && !trimmed.startsWith("#") && equals > 0) {
      const key = trimmed.slice(0, equals).trim();
      if (!(key in process.env)) {
        process.env[key] = trimmed.slice(equals + 1).trim();
      }
    }
  }
}

module.exports = {
  ROOT: ROOT,
  PUBLIC_DIR: path.join(ROOT, "public"),
  DATA_DIR: path.join(ROOT, "data"),
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || "127.0.0.1",
  COOKIE_SECURE: process.env.COOKIE_SECURE === "1",
  SESSION_HOURS: Number(process.env.SESSION_HOURS) || 8,
  DEMO_RECEPTION_PASSWORD: process.env.DEMO_RECEPTION_PASSWORD || "",
  DEMO_MANAGER_PASSWORD: process.env.DEMO_MANAGER_PASSWORD || ""
};
