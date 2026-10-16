"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.AuthRoutes = void 0;
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
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const auth_1 = __importStar(require("../../../middlewares/auth"));
const CreateRateLimiter_1 = require("../../../middlewares/RateLimiter/CreateRateLimiter");
const validateRequest_1 = __importDefault(require("../../../middlewares/validateRequest"));
const config_1 = __importDefault(require("../../config"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const auth_service_1 = require("./auth.service");
const auth_validation_1 = require("./auth.validation");
const router = express_1.default.Router();
// Login: rate limited (10 tries / 15 min per IP) -> validated -> checked
router.post("/login", CreateRateLimiter_1.ConfigLimiter.auth, (0, validateRequest_1.default)(auth_validation_1.AuthValidation.login), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    const result = yield auth_service_1.AuthService.login(email, password);
    // Session token goes in an HTTP-only cookie – never in the response body
    res.cookie(config_1.default.admin_cookie_name, result.token, Object.assign(Object.assign({}, (0, auth_1.sessionCookieOptions)()), { expires: result.expiresAt }));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Logged in successfully",
        data: { email: result.email },
    });
})));
// Logout: the browser deletes the cookie (options must match the ones used to set it)
router.post("/logout", (req, res) => {
    res.clearCookie(config_1.default.admin_cookie_name, (0, auth_1.sessionCookieOptions)());
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Logged out",
        data: null,
    });
});
// Current admin – the admin panel uses this to decide between dashboard and login page
router.get("/me", (0, auth_1.default)(), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = req.admin;
    res.set("Cache-Control", "no-store");
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        data: { email: admin.email },
    });
})));
// Change email and/or PIN. Rate limited like login, because it also checks a PIN.
// On success the old sessions stop working and this browser gets a fresh cookie.
router.patch("/account", CreateRateLimiter_1.ConfigLimiter.auth, (0, auth_1.default)(), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.updateAccount), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = req.admin;
    const result = yield auth_service_1.AuthService.updateAccount(admin._id.toString(), req.body);
    res.cookie(config_1.default.admin_cookie_name, result.token, Object.assign(Object.assign({}, (0, auth_1.sessionCookieOptions)()), { expires: result.expiresAt }));
    res.set("Cache-Control", "no-store");
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Account updated",
        data: { email: result.email },
    });
})));
exports.AuthRoutes = router;
