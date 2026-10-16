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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getS3Head = exports.headS3Object = exports.presignPutUrl = exports.deleteS3Object = exports.getS3Object = void 0;
/**
 * Thin wrappers around the AWS S3 SDK (v3).
 *
 * All Akama images live in S3 (see imageStorage.ts). Objects are uploaded without a public ACL: the bucket should block
 * public access, and images are only ever served through the API, which checks
 * the record's visibility on every request.
 */
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = __importDefault(require("../config"));
// Created on first use (settings are checked then, with a clear error)
let client = null;
/** Returns the shared S3 client, creating it on first use. */
const getClient = () => {
    if (!client) {
        // A clear error beats a cryptic AWS one when settings are missing
        if (!config_1.default.aws_s3_bucket_name ||
            !config_1.default.aws_s3_bucket_region ||
            !config_1.default.aws_access_key ||
            !config_1.default.aws_secret_key) {
            throw new Error("S3 storage requires AWS_S3_BUCKET_NAME, AWS_S3_BUCKET_REGION, AWS_ACCESS_KEY and AWS_SECRET_KEY");
        }
        client = new client_s3_1.S3Client({
            region: config_1.default.aws_s3_bucket_region,
            credentials: {
                accessKeyId: config_1.default.aws_access_key,
                secretAccessKey: config_1.default.aws_secret_key,
            },
        });
    }
    return client;
};
/** Downloads a file as a stream (piped straight to the HTTP response). */
const getS3Object = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getClient().send(new client_s3_1.GetObjectCommand({ Bucket: config_1.default.aws_s3_bucket_name, Key: key }));
    return {
        body: result.Body,
        contentType: result.ContentType,
    };
});
exports.getS3Object = getS3Object;
/** Deletes a file. */
const deleteS3Object = (key) => __awaiter(void 0, void 0, void 0, function* () {
    yield getClient().send(new client_s3_1.DeleteObjectCommand({ Bucket: config_1.default.aws_s3_bucket_name, Key: key }));
});
exports.deleteS3Object = deleteS3Object;
/**
 * Presigned PUT URL: lets the browser upload straight to S3 (same flow as the
 * previous project). The URL is valid for 5 minutes and only for this exact
 * key and Content-Type, so it cannot be reused for anything else.
 */
const presignPutUrl = (key, contentType) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, s3_request_presigner_1.getSignedUrl)(getClient(), new client_s3_1.PutObjectCommand({
        Bucket: config_1.default.aws_s3_bucket_name,
        Key: key,
        ContentType: contentType,
    }), { expiresIn: 300 });
});
exports.presignPutUrl = presignPutUrl;
/** Size / type of an object, or null if it does not exist. */
const headS3Object = (key) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield getClient().send(new client_s3_1.HeadObjectCommand({ Bucket: config_1.default.aws_s3_bucket_name, Key: key }));
        return { size: (_a = result.ContentLength) !== null && _a !== void 0 ? _a : 0, contentType: result.ContentType };
    }
    catch (_b) {
        return null;
    }
});
exports.headS3Object = headS3Object;
/** Reads the first `length` bytes of an object (used to check the real file type). */
const getS3Head = (key, length) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, e_1, _d, _e;
    const result = yield getClient().send(new client_s3_1.GetObjectCommand({
        Bucket: config_1.default.aws_s3_bucket_name,
        Key: key,
        Range: `bytes=0-${length - 1}`,
    }));
    const chunks = [];
    try {
        for (var _f = true, _g = __asyncValues(result.Body), _h; _h = yield _g.next(), _c = _h.done, !_c; _f = true) {
            _e = _h.value;
            _f = false;
            const chunk = _e;
            chunks.push(Buffer.from(chunk));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_f && !_c && (_d = _g.return)) yield _d.call(_g);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return Buffer.concat(chunks);
});
exports.getS3Head = getS3Head;
