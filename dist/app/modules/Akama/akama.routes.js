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
exports.AdminAkamaRoutes = exports.PublicAkamaRoutes = void 0;
/**
 * Akama HTTP routes. Two routers are exported and mounted in app/routes/index.ts:
 *
 * PUBLIC – /api/public/akama (no login; only ever returns public records)
 *   GET  /              list + search public records        -> /akama directory page
 *   GET  /:id           one public record                   -> /akama/{id} page
 *   GET  /:id/image     the image, if the record is public
 *
 * ADMIN – /api/admin/akama (login required for every route)
 *   GET    /                list with search, filters, sort, paging
 *   GET    /stats           total / public / private counts
 *   POST   /upload-url      presigned PUT URL for a direct browser -> S3 upload
 *   POST   /                create (JSON: name, isPublic, imageKey)
 *   GET    /:id             one record
 *   GET    /:id/image       the image (any visibility)
 *   GET    /:id/qr          QR code PNG of the permanent public URL (?download=1 to save)
 *   PATCH  /:id             edit name / image / visibility (JSON, imageKey optional)
 *   PATCH  /:id/visibility  make public or private (JSON)
 *   DELETE /:id             delete record and its image
 *
 * Business logic lives in akama.service.ts; this file handles HTTP details
 * (caching headers, streaming, status codes).
 */
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const qrcode_1 = __importDefault(require("qrcode"));
const auth_1 = __importDefault(require("../../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../../middlewares/validateRequest"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const imageStorage_1 = require("../../utils/imageStorage");
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const akama_service_1 = require("./akama.service");
const akama_validation_1 = require("./akama.validation");
// ================= Shared helpers =================
// Runs for every route with ":id". Invalid IDs are reported exactly like
// missing records (404), so the response never hints at what exists.
const checkId = (req, res, next, id) => {
    if (!(0, mongoose_1.isValidObjectId)(id) || !/^[a-f0-9]{24}$/i.test(id)) {
        return next(new AppError_1.default(http_status_1.default.NOT_FOUND, "Akama record not found"));
    }
    next();
};
// Responses must never be reused after a record changes visibility
const noStore = (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
};
/**
 * Streams the image. "private, no-cache" lets the browser keep a copy but forces it
 * to ask the server again each time, so a record made private stops loading at once.
 */
const sendImage = (req, res, doc) => __awaiter(void 0, void 0, void 0, function* () {
    // ETag = fingerprint of the stored file. If the browser already has this exact
    // file it gets a quick 304 "Not Modified" – but only after the visibility check
    // done by the caller, so a private record still gets 404.
    const etag = `"${crypto_1.default.createHash("sha1").update(doc.imageKey).digest("hex")}"`;
    res.set({
        "Cache-Control": "private, no-cache",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
    });
    if (req.headers["if-none-match"] === etag) {
        res.status(http_status_1.default.NOT_MODIFIED).end();
        return;
    }
    let image;
    try {
        image = yield (0, imageStorage_1.readImage)(doc.imageKey);
    }
    catch (_a) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, "Image not found");
    }
    res.type(image.contentType);
    // Pipe the file straight to the response without loading it all into memory
    image.body.on("error", () => res.destroy());
    image.body.pipe(res);
});
// ================= Public: /api/public/akama =================
const publicRouter = express_1.default.Router();
publicRouter.param("id", checkId);
// Public directory list (search + paging). Service only queries isPublic: true.
publicRouter.get("/", noStore, (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.publicList), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.listPublic(req.query);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: result });
})));
// One public record (404 if private or missing). Returns only id, name, imageUrl.
publicRouter.get("/:id", noStore, (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_service_1.AkamaService.getPublic(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: (0, akama_service_1.toPublicAkama)(doc) });
})));
// Public image – visibility is checked on every single request
publicRouter.get("/:id/image", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_service_1.AkamaService.getPublic(req.params.id);
    yield sendImage(req, res, doc);
})));
// ================= Admin: /api/admin/akama (login required) =================
const adminRouter = express_1.default.Router();
// Every admin route: must be logged in, and responses are never cached
adminRouter.use((0, auth_1.default)(), noStore);
adminRouter.param("id", checkId);
// Records table (search, visibility, date range, sort, paging)
adminRouter.get("/", (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.adminList), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.listAdmin(req.query);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: result });
})));
// Dashboard counters. Declared before "/:id" so "stats" is not read as an ID.
adminRouter.get("/stats", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.stats();
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: result });
})));
// Step 1 of a direct upload: validate the announced file, return { presignedUrl, Key }.
// Declared before "/:id" routes so "upload-url" is never read as an ID.
adminRouter.post("/upload-url", (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.uploadUrl), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fileName, fileType, fileSize, folderName } = req.body;
    const data = yield (0, imageStorage_1.createUploadTarget)({ fileName, fileType, fileSize, folderName });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Presigned URL created successfully!",
        data,
    });
})));
// Create: validate fields -> verify the uploaded S3 image -> save record
adminRouter.post("/", (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.create), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.create(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Akama record created",
        data: result,
    });
})));
// One record (any visibility)
adminRouter.get("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_service_1.AkamaService.getAdmin(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: (0, akama_service_1.toAdminAkama)(doc) });
})));
// Image for the admin table/details (works for private records too)
adminRouter.get("/:id/image", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_service_1.AkamaService.getAdmin(req.params.id);
    yield sendImage(req, res, doc);
})));
// QR code for the record's permanent public URL. Generated on request from the
// ID, so it never needs regenerating or storing, and survives name/image edits.
adminRouter.get("/:id/qr", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_service_1.AkamaService.getAdmin(req.params.id);
    const id = doc._id.toString();
    const png = yield qrcode_1.default.toBuffer((0, akama_service_1.publicUrlFor)(id), {
        type: "png",
        errorCorrectionLevel: "M", // still scans if ~15% is damaged/dirty
        width: 1024, // sharp when printed
        margin: 4, // standard quiet zone for reliable scanning
        color: { dark: "#000000", light: "#ffffff" }, // maximum contrast
    });
    res.set("Content-Type", "image/png");
    // ?download=1 -> browser saves the file instead of showing it
    if (req.query.download) {
        // File name from the person's name, reduced to safe characters
        const safeName = doc.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "akama";
        res.attachment(`akama-qr-${safeName}-${id}.png`);
    }
    res.send(png);
})));
// Edit: any of name / image / visibility. The ID (and so the URL and QR) never changes.
adminRouter.patch("/:id", (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.update), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.update(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Changes saved",
        data: result,
    });
})));
// Make Public / Make Private buttons
adminRouter.patch("/:id/visibility", (0, validateRequest_1.default)(akama_validation_1.AkamaValidation.visibility), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.setVisibility(req.params.id, req.body.isPublic);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.isPublic ? "Record is now public" : "Record is now private",
        data: result,
    });
})));
// Delete record, then its image
adminRouter.delete("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield akama_service_1.AkamaService.remove(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Akama record deleted",
        data: result,
    });
})));
exports.PublicAkamaRoutes = publicRouter;
exports.AdminAkamaRoutes = adminRouter;
