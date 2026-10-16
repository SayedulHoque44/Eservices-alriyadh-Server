"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModel = void 0;
/**
 * Administrator account (MongoDB collection "admins").
 *
 * The site has exactly one administrator, created once by admin.seed.ts and
 * afterwards managed from the admin panel (Account settings -> PATCH /api/auth/account).
 * Only a bcrypt hash of the PIN/password is stored – never the value itself.
 */
const mongoose_1 = require("mongoose");
const adminSchema = new mongoose_1.Schema({
    // Login email, stored lower-case so "Biplob@Gmail.com" still matches
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    // Never returned unless explicitly selected with "+passwordHash"
    passwordHash: { type: String, required: true, select: false },
    // Written into every session token. Raised when the PIN or email changes, so
    // sessions opened with the old credentials stop working everywhere.
    sessionVersion: { type: Number, default: 0 },
}, { timestamps: true });
exports.AdminModel = (0, mongoose_1.model)("Admin", adminSchema);
