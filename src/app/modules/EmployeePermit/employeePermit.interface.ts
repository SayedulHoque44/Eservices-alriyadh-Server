import { Types } from "mongoose";
export interface IEmployeePermit {
  _id: Types.ObjectId;
  permitNumber: string;
  permitType: string;
  permitStartDate: string;
  permitExpiryDate: string;
  userId: string;
  employeeName: string;
  nationality: string;
  profession: string;
  gender: string;
  dateOfBirth: string;
  establishmentNumber: string;
  establishmentName: string;
  createdAt: Date;
  updatedAt: Date;
}
export type TEmployeePermitQuery = { search?: string; page: number; limit: number; sort: "newest" | "oldest" };
