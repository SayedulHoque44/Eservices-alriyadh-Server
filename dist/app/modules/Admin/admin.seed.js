"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAdminCredentials = exports.seedAdmin = void 0;
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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = __importDefault(require("../../config"));
const admin_model_1 = require("./admin.model");
// Reads and normalises the credentials from .env, or explains what is missing
const getSeedCredentials = () => {
    var _a;
    const email = (_a = config_1.default.admin_email) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    const password = config_1.default.admin_password;
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
const seedAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    // Any admin already present? Then there is nothing to do.
    const existing = yield admin_model_1.AdminModel.findOne();
    if (existing) {
        return { created: false, email: existing.email };
    }
    const { email, password } = getSeedCredentials();
    // bcrypt with cost 12: slow on purpose so stolen hashes are hard to crack
    const passwordHash = yield bcryptjs_1.default.hash(password, 12);
    // Upsert guards against two instances seeding at the same moment
    yield admin_model_1.AdminModel.updateOne({ email }, { $setOnInsert: { email, passwordHash } }, { upsert: true });
    console.log(`Administrator account created for ${email}`);
    return { created: true, email };
});
exports.seedAdmin = seedAdmin;
/** Replaces the administrator's email and password with the values from the environment. */
const resetAdminCredentials = () => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = getSeedCredentials();
    const passwordHash = yield bcryptjs_1.default.hash(password, 12);
    const existing = yield admin_model_1.AdminModel.findOne();
    if (!existing) {
        yield admin_model_1.AdminModel.create({ email, passwordHash });
    }
    else {
        // Update the one existing admin in place (keeps it a single-admin system)
        // and log out every existing session
        yield admin_model_1.AdminModel.updateOne({ _id: existing._id }, { email, passwordHash, $inc: { sessionVersion: 1 } });
    }
    console.log(`Administrator credentials reset for ${email}`);
    return { email };
});
exports.resetAdminCredentials = resetAdminCredentials;
