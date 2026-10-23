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
exports.AbsherService = exports.toAppAbsher = exports.toAdminAbsher = void 0;
/**
 * Absher business logic: database queries, PIN + app login, image handling and
 * the shapes of the data sent out. Called by absher.routes.ts.
 *
 * Two kinds of callers:
 *   - admin panel  -> toAdminAbsher (flat fields incl. PIN and image keys)
 *   - mobile app   -> toAppAbsher (nested sections the app renders, never the PIN)
 *
 * Images: the database stores the full S3 key ("<folder>/<file>", e.g.
 * "eservices-alriyadh/absher/1792760514931_profile.png"). They are shown through
 * the CloudFront CDN as <CDN base URL>/<key> – the website builds that URL itself
 * from NEXT_PUBLIC_AWS_IMAGES_CDN_BASE_URL; the app gets it ready-made.
 */
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const imageStorage_1 = require("../../utils/imageStorage");
const absher_model_1 = require("./absher.model");
const NOT_FOUND = "Absher account not found";
const DUPLICATE_ID = "An Absher account with this Resident ID number already exists.";
/** Every text detail key, in one list (used by create/update loops). */
const DETAIL_KEYS = [
    "name", "residentId",
    "nationality", "birthCity", "birthCountry", "dateOfBirth", "maritalStatus", "sponsorshipTransfers",
    "religion", "workPermit", "biometricsCollected", "travelStatus",
    "sponsorName", "sponsorId",
    "insuranceIssueDate", "insuranceExpiryDate", "bloodType",
    "amountDeposit", "passportNumber", "passportType", "passportIssueDate", "passportExpiryDate",
    "passportIssueCity", "passportStatus",
    "idVersion", "idIssueDate", "idExpiryDate",
];
// ================= Helpers =================
// Makes user text safe to use inside a regular expression ("a.b" matches "a.b", not "axb")
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Matches part of the name, resident ID, passport number or sponsor ID (any case)
const searchFilter = (search) => {
    const term = search === null || search === void 0 ? void 0 : search.trim();
    if (!term)
        return {};
    const regex = { $regex: escapeRegex(term), $options: "i" };
    return {
        $or: [{ name: regex }, { residentId: regex }, { passportNumber: regex }, { sponsorId: regex }],
    };
};
// Paging info returned with every list (used by the table pagination)
const paginate = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
});
// The browser has already uploaded the image to S3 (presigned URL); make sure the
// key really points at a valid image before an account may use it.
const resolveImageKey = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!key)
        return undefined;
    yield (0, imageStorage_1.verifyUploadedImage)(key);
    return key;
});
// Unique index would reject it anyway; checking first gives a clear message
const assertIdFree = (residentId, exceptId) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = { residentId };
    if (exceptId)
        filter._id = { $ne: exceptId };
    if (yield absher_model_1.AbsherModel.exists(filter))
        throw new AppError_1.default(http_status_1.default.CONFLICT, DUPLICATE_ID);
});
// ================= Output shapes =================
/** Everything the admin panel needs about an account (including the PIN). */
const toAdminAbsher = (doc) => {
    const id = doc._id.toString();
    const details = Object.fromEntries(DETAIL_KEYS.map(key => { var _a; return [key, (_a = doc[key]) !== null && _a !== void 0 ? _a : ""]; }));
    return Object.assign(Object.assign({ id }, details), { pin: doc.pin, 
        // Full S3 keys; the website shows them as NEXT_PUBLIC_AWS_IMAGES_CDN_BASE_URL + "/" + key
        photoKey: doc.photoKey, cardKey: doc.cardKey, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
};
exports.toAdminAbsher = toAdminAbsher;
// Empty values are shown as "-" in the app
const show = (value) => (value === null || value === void 0 ? void 0 : value.trim()) || "-";
// Arabic text in a value -> the app renders it right-to-left
const hasArabic = (value) => /[\u0600-\u06FF]/.test(value);
/** One label/value row in the app. `copy` = the app shows a copy button. */
const row = (label, value, copy = false) => {
    const shown = show(value);
    return Object.assign(Object.assign({ label, value: shown }, (hasArabic(shown) && { lang: "ar" })), (copy && { copy: true }));
};
// Public CDN address of a stored image: <AWS_IMAGES_CDN_BASE_URL>/<key>
const cdnUrl = (key) => `${config_1.default.aws_images_cdn_base_url}/${key}`;
/**
 * The account in the nested shape the mobile app renders (sections + rows).
 * Built on the fly from the flat document – nothing nested is stored.
 * photo / absher_card are full CDN URLs the app can show directly.
 */
const toAppAbsher = (doc) => {
    var _a;
    return ({
        user: {
            name: doc.name,
            id: doc.residentId,
            photo: doc.photoKey ? cdnUrl(doc.photoKey) : null,
            absher_card: doc.cardKey ? cdnUrl(doc.cardKey) : null,
            personal: {
                sections: [
                    {
                        title: "Personal Details",
                        rows: [
                            row("Name", doc.name),
                            row("Nationality", doc.nationality),
                            row("Birth City", doc.birthCity),
                            row("Birth Country/Region", doc.birthCountry),
                            row("Date of Birth", doc.dateOfBirth),
                            row("Marital Status", doc.maritalStatus),
                            row("No. of sponsorship transfers", doc.sponsorshipTransfers),
                            row("Religion", doc.religion),
                            row("Work Permit", doc.workPermit),
                            row("Biometrics Collected", doc.biometricsCollected),
                            row("Travel Status", doc.travelStatus),
                        ],
                    },
                    {
                        title: "Sponsor Details",
                        rows: [row("Sponsor Name", doc.sponsorName), row("Sponsor ID Number", doc.sponsorId, true)],
                    },
                    {
                        title: "Health Insurance",
                        rows: [
                            row("Issuing Date", doc.insuranceIssueDate),
                            row("Expiry Date", doc.insuranceExpiryDate),
                            row("Blood Type", doc.bloodType),
                        ],
                    },
                ],
            },
            passport: {
                amountDepositLabel: "Amount deposit",
                amountDeposit: show(doc.amountDeposit),
                // e.g. "Normal Passport" (from the passport type)
                sectionTitle: `${((_a = doc.passportType) === null || _a === void 0 ? void 0 : _a.trim()) || "Normal"} Passport`,
                rows: [
                    row("Passport Number", doc.passportNumber, true),
                    row("Type", doc.passportType),
                    row("Issuing Date", doc.passportIssueDate),
                    row("Expiry Date", doc.passportExpiryDate),
                    row("Issuing City", doc.passportIssueCity),
                    row("Status", doc.passportStatus),
                ],
            },
            residentId: {
                cardTitle: "My Resident ID",
                rows: [
                    row("Resident ID Number", doc.residentId, true),
                    row("ID Version", doc.idVersion),
                    row("Issuing Date", doc.idIssueDate),
                    row("Expiry Date", doc.idExpiryDate),
                ],
            },
        },
    });
};
exports.toAppAbsher = toAppAbsher;
// ================= Admin =================
/** Admin table: search + date range + sort + paging. */
const listAdmin = ({ search, from, to, sort, page, limit }) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = searchFilter(search);
    // Creation date range (either end may be missing)
    if (from || to) {
        filter.createdAt = Object.assign(Object.assign({}, (from && { $gte: new Date(from) })), (to && { $lte: new Date(to) }));
    }
    // _id as a tie-breaker keeps the order stable between pages
    const direction = sort === "oldest" ? 1 : -1;
    const [docs, total] = yield Promise.all([
        absher_model_1.AbsherModel.find(filter)
            .sort({ createdAt: direction, _id: direction })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        absher_model_1.AbsherModel.countDocuments(filter),
    ]);
    return { items: docs.map(exports.toAdminAbsher), meta: paginate(page, limit, total) };
});
/** Dashboard counter. */
const stats = () => __awaiter(void 0, void 0, void 0, function* () { return ({ total: yield absher_model_1.AbsherModel.countDocuments() }); });
/** One account (admin only). */
const getAdmin = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield absher_model_1.AbsherModel.findById(id).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    return doc;
});
/**
 * New account. The admin panel creates it with the text details only and then
 * attaches the images (update), so nothing is uploaded unless this succeeds.
 * Image keys are still accepted here for other callers; any failure deletes them.
 */
const create = (input) => __awaiter(void 0, void 0, void 0, function* () {
    let photoKey;
    let cardKey;
    try {
        yield assertIdFree(input.residentId);
        photoKey = yield resolveImageKey(input.photoKey);
        cardKey = yield resolveImageKey(input.cardKey);
        const details = Object.fromEntries(DETAIL_KEYS.map(key => { var _a; return [key, (_a = input[key]) !== null && _a !== void 0 ? _a : ""]; }));
        const doc = yield absher_model_1.AbsherModel.create(Object.assign(Object.assign({}, details), { pin: input.pin, photoKey: photoKey !== null && photoKey !== void 0 ? photoKey : "", cardKey: cardKey !== null && cardKey !== void 0 ? cardKey : "" }));
        return (0, exports.toAdminAbsher)(doc.toObject());
    }
    catch (error) {
        // Account could not be saved -> don't leave unused images behind
        yield (0, imageStorage_1.deleteImageSafely)(input.photoKey);
        yield (0, imageStorage_1.deleteImageSafely)(input.cardKey);
        throw error;
    }
});
/** Edits any field (including the login ID and PIN). */
const update = (id, input) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield absher_model_1.AbsherModel.findById(id);
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    if (!Object.keys(input).some(key => input[key] !== undefined)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Nothing to update.");
    }
    if (input.residentId && input.residentId !== doc.residentId)
        yield assertIdFree(input.residentId, id);
    // Store the new images (if any) before touching the account
    const newPhoto = yield resolveImageKey(input.photoKey);
    let newCard;
    try {
        newCard = yield resolveImageKey(input.cardKey);
    }
    catch (error) {
        yield (0, imageStorage_1.deleteImageSafely)(newPhoto);
        throw error;
    }
    const oldPhoto = doc.photoKey;
    const oldCard = doc.cardKey;
    for (const key of DETAIL_KEYS) {
        if (input[key] !== undefined)
            doc[key] = input[key];
    }
    if (input.pin)
        doc.pin = input.pin;
    if (newPhoto)
        doc.photoKey = newPhoto;
    if (newCard)
        doc.cardKey = newCard;
    try {
        yield doc.save();
    }
    catch (error) {
        // Save failed -> the account still points at the old images; drop the new ones
        yield (0, imageStorage_1.deleteImageSafely)(newPhoto);
        yield (0, imageStorage_1.deleteImageSafely)(newCard);
        throw error;
    }
    // Only remove old images once the account points at the new ones
    if (newPhoto)
        yield (0, imageStorage_1.deleteImageSafely)(oldPhoto);
    if (newCard)
        yield (0, imageStorage_1.deleteImageSafely)(oldCard);
    return (0, exports.toAdminAbsher)(doc.toObject());
});
/** Deletes the account first, then its images. The person can no longer log in. */
const remove = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield absher_model_1.AbsherModel.findByIdAndDelete(id).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    // The account is already gone; a failed file delete is only logged.
    yield (0, imageStorage_1.deleteImageSafely)(doc.photoKey);
    yield (0, imageStorage_1.deleteImageSafely)(doc.cardKey);
    return { id };
});
// ================= Mobile app =================
/**
 * App login: resident ID + PIN -> the user's full details (nested app shape).
 * One call, no token: the app keeps the returned data and calls this again to refresh.
 */
const appLogin = (residentId, pin) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield absher_model_1.AbsherModel.findOne({ residentId }).lean();
    // Same message for "wrong ID" and "wrong PIN" (don't reveal which)
    if (!doc || doc.pin !== pin)
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, "Incorrect ID or PIN.");
    return (0, exports.toAppAbsher)(doc);
});
exports.AbsherService = {
    listAdmin,
    stats,
    getAdmin,
    create,
    update,
    remove,
    appLogin,
};
