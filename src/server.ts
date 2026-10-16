/* eslint-disable no-console */
/**
 * Entry point of the API (`npm run dev` / `npm start`).
 *
 * Startup order:
 *   1. check required settings
 *   2. connect to MongoDB
 *   3. create the administrator if none exists (idempotent seed)
 *   4. start listening for HTTP requests (routes live in app.ts)
 */
import mongoose from "mongoose";
import app from "./app";
import config from "./app/config";
import { seedAdmin } from "./app/modules/Admin/admin.seed";

async function main() {
  try {
    // 1. Fail fast with a clear message if .env is incomplete
    if (!config.database_url) throw new Error("mongoDbUrl is not set in .env");
    if (!config.jwt_access_secret) throw new Error("JWT_ACCESS_SECRCT is not set in .env");

    // Share links and QR codes are built from PUBLIC_APP_URL; warn loudly if
    // production would print codes that point at a development address.
    if (config.is_production && /localhost|127\.0\.0\.1/.test(config.public_app_url)) {
      console.error(
        "WARNING: PUBLIC_APP_URL is not set to the live website. Share links and QR codes will point to",
        config.public_app_url,
      );
    }

    // 2. Database
    await mongoose.connect(config.database_url);

    // 3. Make sure the single administrator exists. A failure here (e.g. missing
    //    ADMIN_EMAIL) is logged but does not stop the server.
    if (config.seed_admin_on_start) {
      try {
        await seedAdmin();
      } catch (error) {
        console.error("Admin seed skipped:", (error as Error).message);
      }
    }

    // 4. HTTP server. If the port is taken, exit instead of running half-started.
    app
      .listen(config.port, () => {
        console.log(`Saudi Computer Services API listening on port ${config.port}`);
      })
      .on("error", error => {
        console.error(`Could not start on port ${config.port}:`, error.message);
        process.exit(1);
      });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

main();

// Last-resort logging so unexpected errors are visible in the server logs
process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection detected,", err);
});

process.on("uncaughtException", err => {
  console.error("uncaughtException detected,", err);
});
