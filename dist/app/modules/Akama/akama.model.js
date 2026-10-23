"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AkamaModel = void 0;
/**
 * Akama record (MongoDB collection "akamas").
 *
 * The MongoDB `_id` is the Akama record ID shown to people and used in the
 * permanent public URL /akama/{id} (and its QR code). It is generated
 * automatically and never changes.
 */
const mongoose_1 = require("mongoose");
const akamaSchema = new mongoose_1.Schema({
    // Person's name as written on the Akama
    name: { type: String, required: true, trim: true, maxlength: 120 },
    certificateNumber: { type: String, required: true, trim: true, maxlength: 80 },
    issueDate: { type: String, required: true, trim: true, maxlength: 40 },
    expiryDate: { type: String, required: true, trim: true, maxlength: 40 },
    identityNumber: { type: String, required: true, trim: true, maxlength: 80 },
    gender: { type: String, required: true, trim: true, maxlength: 40 },
    nationality: { type: String, required: true, trim: true, maxlength: 80 },
    profession: { type: String, required: true, trim: true, maxlength: 160 },
    trainingProgram: { type: String, required: true, trim: true, maxlength: 160 },
    programCompletionDate: { type: String, required: true, trim: true, maxlength: 60 },
    // Optional: may be left empty
    organizationName: { type: String, trim: true, maxlength: 160, default: "" },
    organizationLicenseNumber: { type: String, trim: true, maxlength: 80, default: "" },
    // Storage key of the uploaded image (local disk or S3). The image itself is
    // only served through the API so visibility is checked on every request.
    // Attached right after the record is created (see AkamaFormModal), so "" at first.
    // A record without an image can never be made public (akama.service.ts).
    imageKey: { type: String, default: "" },
    // false = only the admin can see it; true = visible on the public pages
    isPublic: { type: Boolean, default: false, index: true },
}, { timestamps: true });
// Speeds up the public directory (public records, newest first)
akamaSchema.index({ isPublic: 1, createdAt: -1 });
// Speeds up the admin table sorting and date filter
akamaSchema.index({ createdAt: -1 });
exports.AkamaModel = (0, mongoose_1.model)("Card", akamaSchema, "cards");
