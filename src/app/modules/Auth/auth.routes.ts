/**
 * Auth routes, mounted at /api/auth (see app/routes/index.ts).
 *
 *   POST /api/auth/login   check credentials, set the session cookie
 *   POST /api/auth/logout  clear the session cookie
 *   GET  /api/auth/me      who is logged in (401 if nobody)
 *   PATCH /api/auth/account change email and/or PIN (login + current PIN required)
 *
 * Called by the admin panel: Client/components/admin/LoginForm.tsx,
 * AdminShell.tsx (logout), AccountSettingsModal.tsx (account) and useAdmin.ts (useMe).
 */
import express from "express";
import httpStatus from "http-status";
import auth, { sessionCookieOptions } from "../../../middlewares/auth";
import validateRequest from "../../../middlewares/validateRequest";
import config from "../../config";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AuthService } from "./auth.service";
import { AuthValidation } from "./auth.validation";

const router = express.Router();

// Login: validated -> checked
router.post(
  "/login",
  validateRequest(AuthValidation.login),
  catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    // Session token goes in an HTTP-only cookie – never in the response body
    res.cookie(config.admin_cookie_name, result.token, {
      ...sessionCookieOptions(),
      expires: result.expiresAt,
    });
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Logged in successfully",
      data: { email: result.email },
    });
  }),
);

// Logout: the browser deletes the cookie (options must match the ones used to set it)
router.post("/logout", (req, res) => {
  res.clearCookie(config.admin_cookie_name, sessionCookieOptions());
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out",
    data: null,
  });
});

// Current admin – the admin panel uses this to decide between dashboard and login page
router.get(
  "/me",
  auth(),
  catchAsync(async (req, res) => {
    const admin = (req as typeof req & { admin: { email: string } }).admin;
    res.set("Cache-Control", "no-store");
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      data: { email: admin.email },
    });
  }),
);

// Change email and/or PIN (current PIN required).
// On success the old sessions stop working and this browser gets a fresh cookie.
router.patch(
  "/account",
  auth(),
  validateRequest(AuthValidation.updateAccount),
  catchAsync(async (req, res) => {
    const admin = (req as typeof req & { admin: { _id: { toString(): string } } }).admin;
    const result = await AuthService.updateAccount(admin._id.toString(), req.body);
    res.cookie(config.admin_cookie_name, result.token, {
      ...sessionCookieOptions(),
      expires: result.expiresAt,
    });
    res.set("Cache-Control", "no-store");
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Account updated",
      data: { email: result.email },
    });
  }),
);

export const AuthRoutes = router;
