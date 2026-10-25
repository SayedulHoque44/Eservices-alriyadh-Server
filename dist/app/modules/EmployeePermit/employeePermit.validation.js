"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeePermitValidation = void 0;
const zod_1 = require("zod");
const clean = (value) => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
const text = (label, max = 160, optional = false) => {
    const schema = zod_1.z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).transform(clean).pipe(zod_1.z.string().max(max));
    return optional ? schema.default("") : schema.pipe(zod_1.z.string().min(1, `${label} is required`));
};
const fields = {
    permitNumber: text("Permit number", 80), permitType: text("Permit type", 120),
    permitStartDate: text("Permit start date", 40), permitExpiryDate: text("Permit expiry date", 40),
    userId: text("ID/Residence number", 30), employeeName: text("Employee name"), nationality: text("Nationality", 80),
    profession: text("Profession", 120), gender: text("Gender", 40), dateOfBirth: text("Date of birth", 40, true),
    establishmentNumber: text("Establishment number", 80), establishmentName: text("Establishment name", 200),
};
exports.EmployeePermitValidation = {
    adminList: zod_1.z.object({ query: zod_1.z.object({ search: zod_1.z.string().trim().max(100).optional(), page: zod_1.z.coerce.number().int().min(1).default(1), limit: zod_1.z.coerce.number().int().min(1).max(50).default(10), sort: zod_1.z.enum(["newest", "oldest"]).default("newest") }) }),
    create: zod_1.z.object({ body: zod_1.z.object(fields) }),
    update: zod_1.z.object({ body: zod_1.z.object(Object.fromEntries(Object.entries(fields).map(([key, rule]) => [key, rule.optional()]))) }),
};
