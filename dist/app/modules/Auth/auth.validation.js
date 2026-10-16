"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
/**
 * Input rules for the auth routes (used with validateRequest in auth.routes.ts).
 */
const zod_1 = require("zod");
// Trimmed and lower-cased so it matches the stored admin email
const emailField = zod_1.z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address");
// POST /api/auth/login body: { email, password }
const login = zod_1.z.object({
    body: zod_1.z.object({
        email: emailField,
        // max(200) stops someone sending a huge string to slow down bcrypt
        password: zod_1.z
            .string({ required_error: "PIN is required" })
            .min(1, "PIN is required")
            .max(200),
    }),
});
// PATCH /api/auth/account body: { currentPassword, email?, newPassword? }
const updateAccount = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z
            .string({ required_error: "Current PIN is required" })
            .min(1, "Current PIN is required")
            .max(200),
        email: emailField.optional(),
        // At least 6 characters (a 6-digit PIN or a longer password)
        newPassword: zod_1.z
            .string()
            .min(6, "New PIN must be at least 6 characters")
            .max(100, "New PIN must be 100 characters or fewer")
            .optional(),
    }),
});
exports.AuthValidation = { login, updateAccount };
