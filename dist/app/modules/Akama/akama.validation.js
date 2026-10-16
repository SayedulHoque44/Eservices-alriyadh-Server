"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AkamaValidation = void 0;
/**
 * Input rules for every Akama route (used with validateRequest in akama.routes.ts).
 * Anything that fails here never reaches the service or the database.
 */
const zod_1 = require("zod");
// ---------- Reusable field rules ----------
// Person's name: collapse whitespace and drop control characters, then 1–120 chars
const cleanName = zod_1.z
    .string({ required_error: "Name is required", invalid_type_error: "Name is required" })
    // eslint-disable-next-line no-control-regex
    .transform(value => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim())
    .pipe(zod_1.z
    .string()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or fewer"));
const requiredText = (label, max = 160) => zod_1.z.string({ required_error: `${label} is required` })
    // eslint-disable-next-line no-control-regex
    .transform(value => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim())
    .pipe(zod_1.z.string().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`));
// Same cleaning as requiredText, but an empty value is allowed
const optionalText = (label, max = 160) => zod_1.z.string()
    // eslint-disable-next-line no-control-regex
    .transform(value => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim())
    .pipe(zod_1.z.string().max(max, `${label} must be ${max} characters or fewer`));
const cardFields = {
    name: cleanName,
    certificateNumber: requiredText("Certificate number", 80),
    issueDate: requiredText("Issue date", 40),
    expiryDate: requiredText("Expiry date", 40),
    identityNumber: requiredText("Identity number", 80),
    gender: requiredText("Gender", 40),
    nationality: requiredText("Nationality", 80),
    profession: requiredText("Profession"),
    trainingProgram: requiredText("Training program"),
    programCompletionDate: requiredText("Program completion date", 60),
    // Optional fields (empty string allowed)
    organizationName: optionalText("Organization name"),
    organizationLicenseNumber: optionalText("Organization license number", 80),
};
// Public/Private flag. Real booleans are expected; "true"/"false" strings are
// also accepted.
const booleanField = zod_1.z.preprocess(value => {
    if (value === "true" || value === true)
        return true;
    if (value === "false" || value === false)
        return false;
    return value;
}, zod_1.z.boolean({ invalid_type_error: "Visibility must be Public or Private" }));
// ?page=2 -> 2 (query strings are always text)
const pageField = zod_1.z.coerce.number().int().min(1).max(100000).default(1);
// Search text, matched against name or ID (see searchFilter in akama.service.ts)
const searchField = zod_1.z.string().trim().max(100).optional();
// ISO date-time, e.g. 2026-10-13T00:00:00.000Z (sent by the admin date picker)
const dateField = zod_1.z
    .string()
    .datetime({ offset: true, message: "Invalid date" })
    .optional();
// Storage key returned by the upload-url step ("akama/<uuid>.png"); re-verified
// against the stored file in imageStorage.verifyUploadedImage
const imageKeyField = zod_1.z
    .string({ required_error: "Please upload the Akama image." })
    .max(300)
    .regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/, "Invalid image key");
// ---------- Route schemas ----------
// POST /api/admin/akama/upload-url – announce a file, get a presigned PUT URL
const uploadUrl = zod_1.z.object({
    body: zod_1.z.object({
        fileName: zod_1.z.string().trim().min(1).max(255),
        fileType: zod_1.z.enum(["image/jpeg", "image/png", "image/webp"], {
            errorMap: () => ({ message: "Only JPG, PNG and WebP images are allowed." }),
        }),
        fileSize: zod_1.z.coerce.number().int().positive(),
        // Folder inside the bucket, e.g. "eservices-alriyadh/akama" (defaults to AWS_S3_PREFIX)
        folderName: zod_1.z
            .string()
            .trim()
            .max(100)
            .regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/, "Invalid folder name")
            .optional(),
    }),
});
// GET /api/admin/akama – table search, filters, sorting and paging
const adminList = zod_1.z.object({
    query: zod_1.z
        .object({
        search: searchField,
        visibility: zod_1.z.enum(["all", "public", "private"]).default("all"),
        from: dateField, // created on/after
        to: dateField, // created on/before
        sort: zod_1.z.enum(["newest", "oldest"]).default("newest"),
        page: pageField,
        limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
    })
        .refine(q => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
        message: "The start date must be before the end date",
        path: ["from"],
    }),
});
// GET /api/public/akama – public directory search and paging
const publicList = zod_1.z.object({
    query: zod_1.z.object({
        search: searchField,
        page: pageField,
        limit: zod_1.z.coerce.number().int().min(1).max(48).default(12),
    }),
});
// POST /api/admin/akama – new record (new records are private unless chosen otherwise)
const create = zod_1.z.object({
    body: zod_1.z.object(Object.assign(Object.assign({}, cardFields), { 
        // Optional on create: missing -> saved as ""
        organizationName: cardFields.organizationName.default(""), organizationLicenseNumber: cardFields.organizationLicenseNumber.default(""), isPublic: booleanField.default(false), imageKey: imageKeyField })),
});
// PATCH /api/admin/akama/:id – every field optional (only send what changed)
const update = zod_1.z.object({
    body: zod_1.z.object({
        name: cleanName.optional(),
        certificateNumber: cardFields.certificateNumber.optional(),
        issueDate: cardFields.issueDate.optional(),
        expiryDate: cardFields.expiryDate.optional(),
        identityNumber: cardFields.identityNumber.optional(),
        gender: cardFields.gender.optional(),
        nationality: cardFields.nationality.optional(),
        profession: cardFields.profession.optional(),
        trainingProgram: cardFields.trainingProgram.optional(),
        programCompletionDate: cardFields.programCompletionDate.optional(),
        organizationName: cardFields.organizationName.optional(),
        organizationLicenseNumber: cardFields.organizationLicenseNumber.optional(),
        isPublic: booleanField.optional(),
        imageKey: imageKeyField.optional(),
    }),
});
// PATCH /api/admin/akama/:id/visibility – { isPublic: true | false }
const visibility = zod_1.z.object({
    body: zod_1.z.object({ isPublic: booleanField }),
});
exports.AkamaValidation = {
    uploadUrl,
    adminList,
    publicList,
    create,
    update,
    visibility,
};
