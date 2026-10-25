import { z } from "zod";
const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
const text = (label: string, max = 160, optional = false) => {
  const schema = z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).transform(clean).pipe(z.string().max(max));
  return optional ? schema.default("") : schema.pipe(z.string().min(1, `${label} is required`));
};
const fields = {
  permitNumber: text("Permit number", 80), permitType: text("Permit type", 120),
  permitStartDate: text("Permit start date", 40), permitExpiryDate: text("Permit expiry date", 40),
  userId: text("ID/Residence number", 30), employeeName: text("Employee name"), nationality: text("Nationality", 80),
  profession: text("Profession", 120), gender: text("Gender", 40), dateOfBirth: text("Date of birth", 40, true),
  establishmentNumber: text("Establishment number", 80), establishmentName: text("Establishment name", 200),
};
export const EmployeePermitValidation = {
  adminList: z.object({ query: z.object({ search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10), sort: z.enum(["newest", "oldest"]).default("newest") }) }),
  create: z.object({ body: z.object(fields) }),
  update: z.object({ body: z.object(Object.fromEntries(Object.entries(fields).map(([key, rule]) => [key, rule.optional()]))) }),
};
