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
exports.getSessionAdmin = exports.sessionCookieOptions = exports.getCookie = void 0;
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../app/config"));
const AppError_1 = __importDefault(require("../app/error/AppError"));
const admin_model_1 = require("../app/modules/Admin/admin.model");
const catchAsync_1 = __importDefault(require("../app/utils/catchAsync"));
/** Reads one cookie value from the raw "Cookie" request header. */
const getCookie = (req, name) => {
    const header = req.headers.cookie;
    if (!header)
        return undefined;
    // Header format: "a=1; b=2; scs_admin_session=xyz"
    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index > -1 && part.slice(0, index).trim() === name) {
            return decodeURIComponent(part.slice(index + 1).trim());
        }
    }
    return undefined;
};
exports.getCookie = getCookie;
/**
 * Cookie settings for the session:
 *   httpOnly  – JavaScript in the browser cannot read it (protects against XSS theft)
 *   secure    – only sent over HTTPS in production
 *   sameSite  – "lax" stops other websites from sending it with their form posts (CSRF)
 */
const sessionCookieOptions = () => ({
    httpOnly: true,
    secure: config_1.default.is_production,
    sameSite: "lax",
    path: "/",
});
exports.sessionCookieOptions = sessionCookieOptions;
/** Returns the logged-in admin, or null when there is no valid session. */
const getSessionAdmin = (req) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const token = (0, exports.getCookie)(req, config_1.default.admin_cookie_name);
    if (!token)
        return null;
    try {
        // Throws if the token was tampered with or has expired
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
        if (decoded.role !== "admin" || !decoded.sub)
            return null;
        // Also confirm the admin still exists, and that the token was issued after
        // the last PIN/email change (older tokens carry an older version)
        const admin = yield admin_model_1.AdminModel.findById(decoded.sub);
        if (!admin || ((_a = decoded.ver) !== null && _a !== void 0 ? _a : 0) !== ((_b = admin.sessionVersion) !== null && _b !== void 0 ? _b : 0))
            return null;
        return admin;
    }
    catch (_c) {
        return null;
    }
});
exports.getSessionAdmin = getSessionAdmin;
/**
 * Protects admin API routes on the server.
 * Responds 401 when not logged in; otherwise attaches the admin to `req.admin`.
 */
const auth = () => (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = yield (0, exports.getSessionAdmin)(req);
    if (!admin) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, "Please log in to continue.");
    }
    req.admin = admin;
    next();
}));
exports.default = auth;
