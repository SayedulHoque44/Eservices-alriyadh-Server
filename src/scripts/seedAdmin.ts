/* eslint-disable no-console */
/**
 * Command-line seed for the administrator account.
 *
 * Usage:
 *   npm run seed         -> create the administrator if none exists
 *   npm run seed:reset   -> set the administrator's email/password to ADMIN_EMAIL/ADMIN_PASSWORD
 *
 * Connects to the database from .env, runs the seed, then disconnects.
 */
import mongoose from "mongoose";
import config from "../app/config";
import { resetAdminCredentials, seedAdmin } from "../app/modules/Admin/admin.seed";

const run = async () => {
  await mongoose.connect(config.database_url as string);
  if (process.argv.includes("--reset")) {
    await resetAdminCredentials();
  } else {
    const result = await seedAdmin();
    if (!result.created) console.log(`Administrator already exists (${result.email}). Nothing to do.`);
  }
  await mongoose.disconnect();
};

run().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
