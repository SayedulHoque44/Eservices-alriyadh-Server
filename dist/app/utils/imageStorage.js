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
exports.deleteImageSafely = exports.readImage = exports.verifyUploadedImage = exports.createUploadTarget = exports.maxUploadBytes = exports.isValidImageKey = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../error/AppError"));
const s3_1 = require("./s3");
// Detect the real file type from its first bytes ("magic numbers") instead of
// trusting the browser-supplied mimetype or file name, which can be faked.
const detectImageType = (data) => {
    // JPEG: FF D8 FF
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
        return { ext: "jpg", mime: "image/jpeg" };
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (data.length >= 8 &&
        data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return { ext: "png", mime: "image/png" };
    // WebP: "RIFF" .... "WEBP"
    if (data.length >= 12 &&
        data.subarray(0, 4).toString("ascii") === "RIFF" &&
        data.subarray(8, 12).toString("ascii") === "WEBP")
        return { ext: "webp", mime: "image/webp" };
    return null;
};
// Content-Type to send back when S3 does not report one
const MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};
// Extension used in the key for each accepted upload type
const MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};
// Keys look like "<folderName>/<timestamp>_<fileName>" (folder = one or more
// path parts). Only safe characters are allowed, so "../" tricks are impossible.
const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/;
/** True if `key` has the expected "<folder>/<file>.<ext>" shape. */
const isValidImageKey = (key) => KEY_PATTERN.test(key);
exports.isValidImageKey = isValidImageKey;
/** Upload limit in bytes (MAX_UPLOAD_MB). */
const maxUploadBytes = () => config_1.default.max_upload_mb * 1024 * 1024;
exports.maxUploadBytes = maxUploadBytes;
/**
 * Step 1: validate the announced file and hand out a presigned S3 PUT URL + key.
 * Same pattern as the previous project: the client sends folderName + fileName,
 * the key is `${folderName}/${Date.now()}_${fileName}`.
 */
const createUploadTarget = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const { fileName, fileType, fileSize } = input;
    const ext = MIME_TO_EXT[fileType];
    if (!ext) {
        throw new AppError_1.default(http_status_1.default.UNSUPPORTED_MEDIA_TYPE, "Only JPG, PNG and WebP images are allowed.");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Please choose an image file.");
    }
    if (fileSize > (0, exports.maxUploadBytes)()) {
        throw new AppError_1.default(http_status_1.default.REQUEST_ENTITY_TOO_LARGE, `Image is too large. Maximum size is ${config_1.default.max_upload_mb} MB.`);
    }
    // Spaces -> "_", anything unsafe -> "_", extension taken from the real type
    const baseName = fileName
        .replace(/\.[^.]*$/, "")
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .slice(0, 80) || "image";
    const folder = input.folderName || config_1.default.aws_s3_prefix;
    const key = `${folder}/${Date.now()}_${baseName}.${ext}`;
    if (!(0, exports.isValidImageKey)(key)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid folder name.");
    }
    const presignedUrl = yield (0, s3_1.presignPutUrl)(key, fileType);
    return { presignedUrl, Key: key };
});
exports.createUploadTarget = createUploadTarget;
/**
 * Step 3: confirm the key points at a real, small-enough JPG/PNG/WebP in S3.
 * Deletes the object when it fails, so rejected uploads do not pile up.
 */
const verifyUploadedImage = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(0, exports.isValidImageKey)(key))
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Invalid image key.");
    const meta = yield (0, s3_1.headS3Object)(key);
    if (!meta) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "The uploaded image was not found. Please upload it again.");
    }
    const head = yield (0, s3_1.getS3Head)(key, 12);
    if (meta.size > (0, exports.maxUploadBytes)() || !detectImageType(head)) {
        yield (0, exports.deleteImageSafely)(key);
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "The uploaded file is not a valid image.");
    }
});
exports.verifyUploadedImage = verifyUploadedImage;
/** Opens a stored image for streaming. Throws if it does not exist. */
const readImage = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const fallbackType = MIME_BY_EXT[key.split(".").pop() || ""] || "application/octet-stream";
    const { body, contentType } = yield (0, s3_1.getS3Object)(key);
    return { body, contentType: contentType || fallbackType };
});
exports.readImage = readImage;
/** Best-effort delete: a leftover file must never break the database operation. */
const deleteImageSafely = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!key)
        return;
    try {
        yield (0, s3_1.deleteS3Object)(key);
    }
    catch (error) {
        // Only logged: the record change already succeeded, the file is just an orphan
        // eslint-disable-next-line no-console
        console.error(`Could not delete image "${key}". Remove it manually.`, error);
    }
});
exports.deleteImageSafely = deleteImageSafely;
