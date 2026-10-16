/**
 * Login + account logic for the single administrator.
 *
 *   login()          checks email/PIN and creates a signed session token
 *   updateAccount()  changes the admin's email and/or PIN (current PIN required)
 *
 * The route (auth.routes.ts) puts the token into an HTTP-only cookie.
 */
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import jwt, { SignOptions } from "jsonwebtoken";
import config from "../../config";
import AppError from "../../error/AppError";
import { AdminModel } from "../Admin/admin.model";

// Compared against when the email is unknown, so the response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

/**
 * Session token: subject = admin id, role = "admin", ver = admin.sessionVersion,
 * expires per ADMIN_SESSION_EXPIRES_IN.
 */
const createSession = (adminId: string, sessionVersion: number) => {
  const token = jwt.sign(
    { role: "admin", ver: sessionVersion },
    config.jwt_access_secret as string,
    {
      subject: adminId,
      expiresIn: config.admin_session_expires_in as SignOptions["expiresIn"],
    },
  );
  // Read the expiry back from the token so the cookie expires at the same moment
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(exp * 1000) };
};

const login = async (email: string, password: string) => {
  // passwordHash is hidden by default (select: false), so request it explicitly
  const admin = await AdminModel.findOne({ email }).select("+passwordHash");
  const valid = await bcrypt.compare(
    password,
    admin?.passwordHash || DUMMY_HASH,
  );
  // Same message for "wrong email" and "wrong password" (don't reveal which)
  if (!admin || !valid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect email or PIN.");
  }

  return {
    ...createSession(admin._id.toString(), admin.sessionVersion ?? 0),
    email: admin.email,
  };
};

/**
 * Changes the admin's email and/or PIN. The current PIN is always required, so a
 * session left open on another computer cannot be used to take over the account.
 * Afterwards every other session is logged out; the caller gets a fresh one.
 */
const updateAccount = async (
  adminId: string,
  input: { currentPassword: string; email?: string; newPassword?: string },
) => {
  const admin = await AdminModel.findById(adminId).select("+passwordHash");
  if (!admin) throw new AppError(httpStatus.UNAUTHORIZED, "Please log in to continue.");

  if (!(await bcrypt.compare(input.currentPassword, admin.passwordHash))) {
    throw new AppError(httpStatus.BAD_REQUEST, "Current PIN is incorrect.");
  }

  const emailChanged = input.email !== undefined && input.email !== admin.email;
  if (!emailChanged && !input.newPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Nothing to update.");
  }

  // Unique index would reject it anyway; checking first gives a clear message
  if (emailChanged && (await AdminModel.exists({ email: input.email, _id: { $ne: admin._id } }))) {
    throw new AppError(httpStatus.CONFLICT, "This email is already in use.");
  }

  if (emailChanged) admin.email = input.email as string;
  if (input.newPassword) admin.passwordHash = await bcrypt.hash(input.newPassword, 12);
  // Invalidate every existing session token (other browsers/devices)
  admin.sessionVersion = (admin.sessionVersion ?? 0) + 1;
  await admin.save();

  return {
    ...createSession(admin._id.toString(), admin.sessionVersion),
    email: admin.email,
  };
};

export const AuthService = { login, updateAccount };
