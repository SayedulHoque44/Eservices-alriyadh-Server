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
exports.AdminAbsherRoutes = exports.AppAbsherRoutes = void 0;
/**
 * Absher HTTP routes. Two routers are exported and mounted in app/routes/index.ts:
 *
 * APP – /api/app/absher (the mobile app)
 *   POST /login        { id, pin } -> { user: full details }
 *   One call, no token. Image links in the response are signed S3 URLs (1 hour).
 *
 * ADMIN – /api/admin/absher (admin login required for every route)
 *   GET    /             list with search, date filter, sort, paging
 *   GET    /stats        total count
 *   POST   /             create (JSON: details + pin; images are attached afterwards with PATCH)
 *   GET    /:id          one account
 *   PATCH  /:id          edit any field, including the login ID and PIN
 *   DELETE /:id          delete account and its images
 *
 * Images are uploaded with the shared POST /api/admin/akama/upload-url step
 * (folder "eservices-alriyadh/absher"); only their full keys are stored and they
 * are shown through the CloudFront CDN (<CDN base URL>/<key>). No public page, no QR code.
 * Business logic lives in absher.service.ts; this file handles HTTP details.
 */
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const auth_1 = __importDefault(require("../../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../../middlewares/validateRequest"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const absher_service_1 = require("./absher.service");
const absher_validation_1 = require("./absher.validation");
// ================= Shared helpers =================
// Runs for every route with ":id". Invalid IDs are reported exactly like
// missing accounts (404), so the response never hints at what exists.
const checkId = (req, res, next, id) => {
    if (!(0, mongoose_1.isValidObjectId)(id) || !/^[a-f0-9]{24}$/i.test(id)) {
        return next(new AppError_1.default(http_status_1.default.NOT_FOUND, "Absher account not found"));
    }
    next();
};
// Personal data: responses must never be stored by browsers or proxies
const noStore = (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
};
// ================= App: /api/app/absher =================
const appRouter = express_1.default.Router();
appRouter.use(noStore);
// Login: validated -> the user's full details
appRouter.post("/login", (0, validateRequest_1.default)(absher_validation_1.AbsherValidation.appLogin), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.appLogin(req.body.id, req.body.pin);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, message: "Logged in successfully", data: result });
})));
// ================= Admin: /api/admin/absher (login required) =================
const adminRouter = express_1.default.Router();
// Every admin route: must be logged in, and responses are never cached
adminRouter.use((0, auth_1.default)(), noStore);
adminRouter.param("id", checkId);
// Accounts table (search, date range, sort, paging)
adminRouter.get("/", (0, validateRequest_1.default)(absher_validation_1.AbsherValidation.adminList), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.listAdmin(req.query);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: result });
})));
// Dashboard counter. Declared before "/:id" so "stats" is not read as an ID.
adminRouter.get("/stats", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.stats();
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: result });
})));
// Create: validate fields -> verify the uploaded images -> save account
adminRouter.post("/", (0, validateRequest_1.default)(absher_validation_1.AbsherValidation.create), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.create(req.body);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.CREATED, success: true, message: "Absher account created", data: result });
})));
// One account
adminRouter.get("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield absher_service_1.AbsherService.getAdmin(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: (0, absher_service_1.toAdminAbsher)(doc) });
})));
// Edit: any field. Only the fields sent are changed.
adminRouter.patch("/:id", (0, validateRequest_1.default)(absher_validation_1.AbsherValidation.update), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.update(req.params.id, req.body);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, message: "Changes saved", data: result });
})));
// Delete account, then its images
adminRouter.delete("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield absher_service_1.AbsherService.remove(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, message: "Absher account deleted", data: result });
})));
exports.AppAbsherRoutes = appRouter;
exports.AdminAbsherRoutes = adminRouter;
