/**
 * Input rules for the auth routes (used with validateRequest in auth.routes.ts).
 */
import { z } from "zod";

// Trimmed and lower-cased so it matches the stored admin email
const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

// POST /api/auth/login body: { email, password }
const login = z.object({
  body: z.object({
    email: emailField,
    // max(200) stops someone sending a huge string to slow down bcrypt
    password: z
      .string({ required_error: "PIN is required" })
      .min(1, "PIN is required")
      .max(200),
  }),
});

// PATCH /api/auth/account body: { currentPassword, email?, newPassword? }
const updateAccount = z.object({
  body: z.object({
    currentPassword: z
      .string({ required_error: "Current PIN is required" })
      .min(1, "Current PIN is required")
      .max(200),
    email: emailField.optional(),
    // At least 6 characters (a 6-digit PIN or a longer password)
    newPassword: z
      .string()
      .min(6, "New PIN must be at least 6 characters")
      .max(100, "New PIN must be 100 characters or fewer")
      .optional(),
  }),
});

export const AuthValidation = { login, updateAccount };
