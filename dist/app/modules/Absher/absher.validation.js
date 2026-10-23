"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsherValidation = void 0;
/**
 * Input rules for every Absher route (used with validateRequest in absher.routes.ts).
 * Anything that fails here never reaches the service or the database.
 */
const zod_1 = require("zod");
// ---------- Reusable field rules ----------
// Collapse whitespace and drop control characters
const clean = (value) => 
// eslint-disable-next-line no-control-regex
value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
const requiredText = (label, max = 160) => zod_1.z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .transform(clean)
    .pipe(zod_1.z.string().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`));
// Same cleaning as requiredText, but an empty value is allowed
const optionalText = (label, max = 160) => zod_1.z
    .string()
    .transform(clean)
    .pipe(zod_1.z.string().max(max, `${label} must be ${max} characters or fewer`));
// Resident ID = app login ID: letters/digits only, so it is easy to type on a phone
const residentIdField = zod_1.z
    .string({ required_error: "Resident ID number is required" })
    .trim()
    .regex(/^[A-Za-z0-9]{4,20}$/, "Resident ID number must be 4–20 letters or digits");
// App PIN: any characters (letters, digits, symbols, Arabic…), 4–20 long
const pinField = zod_1.z
    .string({ required_error: "PIN is required" })
    .trim()
    .min(4, "PIN must be 4–20 characters")
    .max(20, "PIN must be 4–20 characters");
// Storage key returned by the upload-url step; re-verified against the stored
// file in imageStorage.verifyUploadedImage
const imageKeyField = (label) => zod_1.z
    .string({ required_error: `Please upload the ${label}.` })
    .max(300)
    .regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/, "Invalid image key");
// Optional text details (all may be left empty; the app shows "-" for empty ones)
const detailFields = {
    nationality: optionalText("Nationality", 80),
    birthCity: optionalText("Birth city", 80),
    birthCountry: optionalText("Birth country/region", 80),
    dateOfBirth: optionalText("Date of birth", 40),
    maritalStatus: optionalText("Marital status", 40),
    sponsorshipTransfers: optionalText("No. of sponsorship transfers", 10),
    religion: optionalText("Religion", 40),
    workPermit: optionalText("Work permit", 80),
    biometricsCollected: optionalText("Biometrics collected", 20),
    travelStatus: optionalText("Travel status", 40),
    sponsorName: optionalText("Sponsor name", 160),
    sponsorId: optionalText("Sponsor ID number", 40),
    insuranceIssueDate: optionalText("Insurance issuing date", 40),
    insuranceExpiryDate: optionalText("Insurance expiry date", 40),
    bloodType: optionalText("Blood type", 10),
    amountDeposit: optionalText("Amount deposit", 40),
    passportNumber: optionalText("Passport number", 40),
    passportType: optionalText("Passport type", 40),
    passportIssueDate: optionalText("Passport issuing date", 40),
    passportExpiryDate: optionalText("Passport expiry date", 40),
    passportIssueCity: optionalText("Passport issuing city", 80),
    passportStatus: optionalText("Passport status", 40),
    idVersion: optionalText("ID version", 10),
    idIssueDate: optionalText("ID issuing date", 40),
    idExpiryDate: optionalText("ID expiry date", 40),
};
// Every detail field optional with "" as default (used on create)
const detailDefaults = Object.fromEntries(Object.entries(detailFields).map(([key, rule]) => [key, rule.default("")]));
// Every detail field optional with no default (used on edit: only send what changed)
const detailOptional = Object.fromEntries(Object.entries(detailFields).map(([key, rule]) => [key, rule.optional()]));
// ISO date-time, e.g. 2026-10-13T00:00:00.000Z (sent by the admin date picker)
const dateField = zod_1.z.string().datetime({ offset: true, message: "Invalid date" }).optional();
// ---------- Route schemas ----------
// GET /api/admin/absher – table search, date filter, sorting and paging
const adminList = zod_1.z.object({
    query: zod_1.z
        .object({
        search: zod_1.z.string().trim().max(100).optional(),
        from: dateField, // created on/after
        to: dateField, // created on/before
        sort: zod_1.z.enum(["newest", "oldest"]).default("newest"),
        page: zod_1.z.coerce.number().int().min(1).max(100000).default(1),
        limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
    })
        .refine(q => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
        message: "The start date must be before the end date",
        path: ["from"],
    }),
});
// POST /api/admin/absher – new account (name, ID and PIN required).
// Images are not sent here: the admin panel uploads them only after the account
// was created, then attaches them with PATCH – so a rejected form never leaves
// uploaded files behind.
const create = zod_1.z.object({
    body: zod_1.z.object(Object.assign(Object.assign({ name: requiredText("Name", 120), residentId: residentIdField, pin: pinField }, detailDefaults), { photoKey: imageKeyField("profile photo").optional(), cardKey: imageKeyField("Absher card").optional() })),
});
// PATCH /api/admin/absher/:id – every field optional (only send what changed)
const update = zod_1.z.object({
    body: zod_1.z.object(Object.assign(Object.assign({ name: requiredText("Name", 120).optional(), residentId: residentIdField.optional(), pin: pinField.optional() }, detailOptional), { photoKey: imageKeyField("profile photo").optional(), cardKey: imageKeyField("Absher card").optional() })),
});
// POST /api/app/absher/login – the app user's resident ID + PIN
const appLogin = zod_1.z.object({
    body: zod_1.z.object({
        id: zod_1.z.string({ required_error: "ID is required" }).trim().min(1, "ID is required").max(20),
        pin: zod_1.z.string({ required_error: "PIN is required" }).trim().min(1, "PIN is required").max(20),
    }),
});
exports.AbsherValidation = { adminList, create, update, appLogin };
