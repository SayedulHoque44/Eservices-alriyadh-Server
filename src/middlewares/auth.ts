/**
 * Admin authentication helpers.
 *
 * The admin session is a signed JWT stored in an HTTP-only cookie
 * (`scs_admin_session`). The cookie is set by POST /api/auth/login
 * (Auth/auth.routes.ts) and checked here on every protected request.
 *
 * Used by:
 *   - auth()            -> guards every /api/admin/* route and /api/auth/me
 *   - getCookie()       -> small cookie reader (no cookie-parser dependency)
 *   - sessionCookieOptions() -> shared options for setting/clearing the cookie
 */
import { CookieOptions, Request } from "express";
import httpStatus from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../app/config";
import AppError from "../app/error/AppError";
import { AdminModel } from "../app/modules/Admin/admin.model";
import catchAsync from "../app/utils/catchAsync";

/** Reads one cookie value from the raw "Cookie" request header. */
export const getCookie = (req: Request, name: string) => {
  const header = req.headers.cookie;
  if (!header) return undefined;
  // Header format: "a=1; b=2; scs_admin_session=xyz"
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > -1 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
};

/**
 * Cookie settings for the session:
 *   httpOnly  – JavaScript in the browser cannot read it (protects against XSS theft)
 *   secure    – only sent over HTTPS in production
 *   sameSite  – "lax" stops other websites from sending it with their form posts (CSRF)
 */
export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.is_production,
  sameSite: "lax",
  path: "/",
});

/** Returns the logged-in admin, or null when there is no valid session. */
export const getSessionAdmin = async (req: Request) => {
  const token = getCookie(req, config.admin_cookie_name);
  if (!token) return null;
  try {
    // Throws if the token was tampered with or has expired
    const decoded = jwt.verify(
      token,
      config.jwt_access_secret as string,
    ) as JwtPayload;
    if (decoded.role !== "admin" || !decoded.sub) return null;
    // Also confirm the admin still exists, and that the token was issued after
    // the last PIN/email change (older tokens carry an older version)
    const admin = await AdminModel.findById(decoded.sub);
    if (!admin || (decoded.ver ?? 0) !== (admin.sessionVersion ?? 0)) return null;
    return admin;
  } catch {
    return null;
  }
};

/**
 * Protects admin API routes on the server.
 * Responds 401 when not logged in; otherwise attaches the admin to `req.admin`.
 */
const auth = () =>
  catchAsync(async (req, res, next) => {
    const admin = await getSessionAdmin(req);
    if (!admin) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Please log in to continue.",
      );
    }
    (req as Request & { admin?: typeof admin }).admin = admin;
    next();
  });

export default auth;
