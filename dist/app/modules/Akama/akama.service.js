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
exports.AkamaService = exports.toPublicAkama = exports.toAdminAkama = exports.publicUrlFor = void 0;
/**
 * Akama business logic: database queries, image handling and the shapes of
 * the data sent to the browser. Called by akama.routes.ts.
 *
 * Privacy rule: the public functions (listPublic, getPublic) always include
 * `isPublic: true` in the database query itself, so a private record can never
 * be returned to a visitor – not even briefly.
 */
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const imageStorage_1 = require("../../utils/imageStorage");
const akama_model_1 = require("./akama.model");
const NOT_FOUND = "Akama record not found";
// ================= Helpers =================
// Makes user text safe to use inside a regular expression ("a.b" matches "a.b", not "axb")
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Matches part of the name (any case) or part of the record ID
const searchFilter = (search) => {
    const term = search === null || search === void 0 ? void 0 : search.trim();
    if (!term)
        return {};
    const or = [
        { name: { $regex: escapeRegex(term), $options: "i" } },
        { certificateNumber: { $regex: escapeRegex(term), $options: "i" } },
        { identityNumber: { $regex: escapeRegex(term), $options: "i" } },
    ];
    // Looks like (part of) an ID? Also compare against the ID as text.
    if (/^[a-f0-9]{4,24}$/i.test(term)) {
        or.push({
            $expr: {
                $regexMatch: { input: { $toString: "$_id" }, regex: term.toLowerCase() },
            },
        });
    }
    return { $or: or };
};
// Paging info returned with every list (used by the table / directory pagination)
const paginate = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
});
// Changes whenever the record is saved; added to image URLs (?v=...) so the
// browser fetches the new picture after an image replacement.
const version = (doc) => new Date(doc.updatedAt).getTime();
/** Canonical, permanent public URL of a record. Depends only on the ID.
 *  Must match the website page Client/app/akama/[id]/page.tsx. */
const publicUrlFor = (id) => `${config_1.default.public_app_url}/akama/${id}`;
exports.publicUrlFor = publicUrlFor;
/** Everything the admin panel needs about a record. */
const toAdminAkama = (doc) => {
    const id = doc._id.toString();
    return {
        id,
        name: doc.name,
        certificateNumber: doc.certificateNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        identityNumber: doc.identityNumber,
        gender: doc.gender,
        nationality: doc.nationality,
        profession: doc.profession,
        trainingProgram: doc.trainingProgram,
        programCompletionDate: doc.programCompletionDate,
        organizationName: doc.organizationName,
        organizationLicenseNumber: doc.organizationLicenseNumber,
        isPublic: doc.isPublic,
        publicUrl: (0, exports.publicUrlFor)(id), // shown in admin + encoded in the QR code
        imageUrl: `/api/admin/card/${id}/image?v=${version(doc)}`,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};
exports.toAdminAkama = toAdminAkama;
// Only what a visitor needs. Never call this for a private record.
const toPublicAkama = (doc) => {
    const id = doc._id.toString();
    return {
        id,
        name: doc.name,
        certificateNumber: doc.certificateNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        identityNumber: doc.identityNumber,
        gender: doc.gender,
        nationality: doc.nationality,
        profession: doc.profession,
        trainingProgram: doc.trainingProgram,
        programCompletionDate: doc.programCompletionDate,
        organizationName: doc.organizationName,
        organizationLicenseNumber: doc.organizationLicenseNumber,
        imageUrl: `/api/public/card/${id}/image?v=${version(doc)}`,
    };
};
exports.toPublicAkama = toPublicAkama;
// ================= Public (only isPublic: true is ever queried) =================
/** Public directory: newest first, optional search. */
const listPublic = ({ search, page, limit }) => __awaiter(void 0, void 0, void 0, function* () {
    // isPublic is set last so a search filter can never override it
    const filter = Object.assign(Object.assign({}, searchFilter(search)), { isPublic: true });
    // Run the page query and the total count at the same time
    const [docs, total] = yield Promise.all([
        akama_model_1.AkamaModel.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        akama_model_1.AkamaModel.countDocuments(filter),
    ]);
    return { items: docs.map(exports.toPublicAkama), meta: paginate(page, limit, total) };
});
/** One public record. Private and missing records both give the same 404. */
const getPublic = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_model_1.AkamaModel.findOne({ _id: id, isPublic: true }).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    return doc;
});
// ================= Admin =================
/** Admin table: search + visibility + date range + sort + paging. */
const listAdmin = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { search, visibility, from, to, sort, page, limit } = query;
    const filter = searchFilter(search);
    // "all" = no visibility filter
    if (visibility !== "all")
        filter.isPublic = visibility === "public";
    // Creation date range (either end may be missing)
    if (from || to) {
        filter.createdAt = Object.assign(Object.assign({}, (from && { $gte: new Date(from) })), (to && { $lte: new Date(to) }));
    }
    // _id as a tie-breaker keeps the order stable between pages
    const direction = sort === "oldest" ? 1 : -1;
    const [docs, total] = yield Promise.all([
        akama_model_1.AkamaModel.find(filter)
            .sort({ createdAt: direction, _id: direction })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        akama_model_1.AkamaModel.countDocuments(filter),
    ]);
    return { items: docs.map(exports.toAdminAkama), meta: paginate(page, limit, total) };
});
/** Dashboard counters. */
const stats = () => __awaiter(void 0, void 0, void 0, function* () {
    const [total, publicCount] = yield Promise.all([
        akama_model_1.AkamaModel.countDocuments(),
        akama_model_1.AkamaModel.countDocuments({ isPublic: true }),
    ]);
    return { total, public: publicCount, private: total - publicCount };
});
/** One record, any visibility (admin only). */
const getAdmin = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_model_1.AkamaModel.findById(id).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    return doc;
});
/** Saves the image first, then the record. MongoDB generates the permanent ID. */
// The browser has already uploaded the image to S3 (presigned URL); make sure the
// key really points at a valid image before a record may use it.
const resolveImageKey = (input) => __awaiter(void 0, void 0, void 0, function* () {
    if (!input.imageKey)
        return undefined;
    yield (0, imageStorage_1.verifyUploadedImage)(input.imageKey);
    return input.imageKey;
});
const create = (input) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const imageKey = yield resolveImageKey(input); // validates type/size too
    if (!imageKey)
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Please choose an Akama image.");
    try {
        const doc = yield akama_model_1.AkamaModel.create({
            name: input.name,
            certificateNumber: input.certificateNumber,
            issueDate: input.issueDate,
            expiryDate: input.expiryDate,
            identityNumber: input.identityNumber,
            gender: input.gender,
            nationality: input.nationality,
            profession: input.profession,
            trainingProgram: input.trainingProgram,
            programCompletionDate: input.programCompletionDate,
            // Optional fields: stored as "" when left empty
            organizationName: (_a = input.organizationName) !== null && _a !== void 0 ? _a : "",
            organizationLicenseNumber: (_b = input.organizationLicenseNumber) !== null && _b !== void 0 ? _b : "",
            isPublic: input.isPublic,
            imageKey,
        });
        return (0, exports.toAdminAkama)(doc.toObject());
    }
    catch (error) {
        // Record could not be saved -> don't leave an unused image behind
        yield (0, imageStorage_1.deleteImageSafely)(imageKey);
        throw error;
    }
});
/** Edits name / visibility / image. The ID never changes, so links and QR codes keep working. */
const update = (id, input) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_model_1.AkamaModel.findById(id);
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    if (!Object.keys(input).some(key => input[key] !== undefined)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, "Nothing to update.");
    }
    // Store the new image (if any) before touching the record
    const newKey = yield resolveImageKey(input);
    const oldKey = doc.imageKey;
    for (const key of ["name", "certificateNumber", "issueDate", "expiryDate", "identityNumber", "gender", "nationality", "profession", "trainingProgram", "programCompletionDate", "organizationName", "organizationLicenseNumber", "isPublic"]) {
        if (input[key] !== undefined)
            doc[key] = input[key];
    }
    if (newKey)
        doc.imageKey = newKey;
    try {
        yield doc.save();
    }
    catch (error) {
        // Save failed -> the record still points at the old image; drop the new one
        yield (0, imageStorage_1.deleteImageSafely)(newKey);
        throw error;
    }
    // Only remove the old image once the record points at the new one
    if (newKey)
        yield (0, imageStorage_1.deleteImageSafely)(oldKey);
    return (0, exports.toAdminAkama)(doc.toObject());
});
/** Make Public / Make Private. Takes effect immediately on the public pages. */
const setVisibility = (id, isPublic) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_model_1.AkamaModel.findByIdAndUpdate(id, { isPublic }, { new: true }).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    return (0, exports.toAdminAkama)(doc);
});
/** Deletes the record first, then its image. */
const remove = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield akama_model_1.AkamaModel.findByIdAndDelete(id).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    // The record is already gone; a failed file delete is only logged.
    yield (0, imageStorage_1.deleteImageSafely)(doc.imageKey);
    return { id };
});
exports.AkamaService = {
    listPublic,
    getPublic,
    listAdmin,
    stats,
    getAdmin,
    create,
    update,
    setVisibility,
    remove,
};
