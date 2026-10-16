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
exports.AuthService = void 0;
/**
 * Login + account logic for the single administrator.
 *
 *   login()          checks email/PIN and creates a signed session token
 *   updateAccount()  changes the admin's email and/or PIN (current PIN required)
 *
 * The route (auth.routes.ts) puts the token into an HTTP-only cookie.
 */
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const admin_model_1 = require("../Admin/admin.model");
// Compared against when the email is unknown, so the response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcryptjs_1.default.hashSync("not-a-real-password", 12);
/**
 * Session token: subject = admin id, role = "admin", ver = admin.sessionVersion,
 * expires per ADMIN_SESSION_EXPIRES_IN.
 */
const createSession = (adminId, sessionVersion) => {
    const token = jsonwebtoken_1.default.sign({ role: "admin", ver: sessionVersion }, config_1.default.jwt_access_secret, {
        subject: adminId,
        expiresIn: config_1.default.admin_session_expires_in,
    });
    // Read the expiry back from the token so the cookie expires at the same moment
    const { exp } = jsonwebtoken_1.default.decode(token);
    return { token, expiresAt: new Date(exp * 1000) };
};
const login = (email, password) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // passwordHash is hidden by default (select: false), so request it explicitly
    const admin = yield admin_model_1.AdminModel.findOne({ email }).select("+passwordHash");
    const valid = yield bcryptjs_1.default.compare(password, (admin === null || admin === void 0 ? void 0 : admin.passwordHash) || DUMMY_HASH);
    // Same message for "wrong email" and "wrong password" (don't reveal which)
    if (!admin || !valid) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, "Incorrect email or PIN.");
    }
    return Object.assign(Object.assign({}, createSession(admin._id.toString(), (_a = admin.sessionVersion) !== null && _a !== void 0 ? _a : 0)), { email: admin.email });
});
/**
 * Changes the admin's email and/or PIN. The current PIN is always required, so a
 * session left open on another computer cannot be used to take over the account.
 * Afterwards every other session is logged out; the caller gets a fresh one.
 */
const updateAccount = (adminId, input) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const admin = yield admin_model_1.AdminModel.findById(adminId).select("+passwordHash");
    if (!admin)
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, "Please log in to continue.");
    if (!(yield bcryptjs_1.default.compare(input.currentPassword, admin.passwordHash))) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Current PIN is incorrect.");
    }
    const emailChanged = input.email !== undefined && input.email !== admin.email;
    if (!emailChanged && !input.newPassword) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Nothing to update.");
    }
    // Unique index would reject it anyway; checking first gives a clear message
    if (emailChanged && (yield admin_model_1.AdminModel.exists({ email: input.email, _id: { $ne: admin._id } }))) {
        throw new AppError_1.default(http_status_1.default.CONFLICT, "This email is already in use.");
    }
    if (emailChanged)
        admin.email = input.email;
    if (input.newPassword)
        admin.passwordHash = yield bcryptjs_1.default.hash(input.newPassword, 12);
    // Invalidate every existing session token (other browsers/devices)
    admin.sessionVersion = ((_b = admin.sessionVersion) !== null && _b !== void 0 ? _b : 0) + 1;
    yield admin.save();
    return Object.assign(Object.assign({}, createSession(admin._id.toString(), admin.sessionVersion)), { email: admin.email });
});
exports.AuthService = { login, updateAccount };
