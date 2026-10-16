/* eslint-disable no-console */
/**
 * Creates / resets the single administrator from ADMIN_EMAIL and ADMIN_PASSWORD.
 *
 * Only for the very first setup or for recovery (forgotten PIN). Day-to-day the
 * email and PIN are changed in the admin panel (Account settings), and the two
 * variables can stay empty.
 *
 * Called from:
 *   - server.ts on startup (when SEED_ADMIN_ON_START=true) -> seedAdmin()
 *   - `npm run seed`       (scripts/seedAdmin.ts)          -> seedAdmin()
 *   - `npm run seed:reset` (scripts/seedAdmin.ts --reset)  -> resetAdminCredentials()
 */
import bcrypt from "bcryptjs";
import config from "../../config";
import { AdminModel } from "./admin.model";

// Reads and normalises the credentials from .env, or explains what is missing
const getSeedCredentials = () => {
  const email = config.admin_email?.trim().toLowerCase();
  const password = config.admin_password;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the administrator.");
  }
  return { email, password };
};

/**
 * Creates the single administrator if none exists yet.
 * Safe to run many times: it never creates a second admin and never
 * overwrites an existing password.
 */
export const seedAdmin = async () => {
  // Any admin already present? Then there is nothing to do.
  const existing = await AdminModel.findOne();
  if (existing) {
    return { created: false, email: existing.email };
  }
  const { email, password } = getSeedCredentials();
  // bcrypt with cost 12: slow on purpose so stolen hashes are hard to crack
  const passwordHash = await bcrypt.hash(password, 12);
  // Upsert guards against two instances seeding at the same moment
  await AdminModel.updateOne(
    { email },
    { $setOnInsert: { email, passwordHash } },
    { upsert: true },
  );
  console.log(`Administrator account created for ${email}`);
  return { created: true, email };
};

/** Replaces the administrator's email and password with the values from the environment. */
export const resetAdminCredentials = async () => {
  const { email, password } = getSeedCredentials();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await AdminModel.findOne();
  if (!existing) {
    await AdminModel.create({ email, passwordHash });
  } else {
    // Update the one existing admin in place (keeps it a single-admin system)
    // and log out every existing session
    await AdminModel.updateOne(
      { _id: existing._id },
      { email, passwordHash, $inc: { sessionVersion: 1 } },
    );
  }
  console.log(`Administrator credentials reset for ${email}`);
  return { email };
};
