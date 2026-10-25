import { model, Schema } from "mongoose";
import { IEmployeePermit } from "./employeePermit.interface";
const employeePermitSchema = new Schema<IEmployeePermit>({
  permitNumber: { type: String, required: true, trim: true, maxlength: 80 },
  permitType: { type: String, required: true, trim: true, maxlength: 120 },
  permitStartDate: { type: String, required: true, trim: true, maxlength: 40 },
  permitExpiryDate: { type: String, required: true, trim: true, maxlength: 40 },
  userId: { type: String, required: true, trim: true, maxlength: 30, unique: true },
  employeeName: { type: String, required: true, trim: true, maxlength: 160 },
  nationality: { type: String, required: true, trim: true, maxlength: 80 },
  profession: { type: String, required: true, trim: true, maxlength: 120 },
  gender: { type: String, required: true, trim: true, maxlength: 40 },
  dateOfBirth: { type: String, trim: true, maxlength: 40, default: "" },
  establishmentNumber: { type: String, required: true, trim: true, maxlength: 80 },
  establishmentName: { type: String, required: true, trim: true, maxlength: 200 },
}, { timestamps: true, collection: "employee_permits" });
employeePermitSchema.index({ createdAt: -1 });
export const EmployeePermitModel = model<IEmployeePermit>("EmployeePermit", employeePermitSchema);
