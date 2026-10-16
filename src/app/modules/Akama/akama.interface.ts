/**
 * TypeScript types for the Akama module.
 */
import { Types } from "mongoose";

/** A stored Akama record (see akama.model.ts). */
export interface IAkama {
  _id: Types.ObjectId;
  name: string;
  certificateNumber: string;
  issueDate: string;
  expiryDate: string;
  identityNumber: string;
  gender: string;
  nationality: string;
  profession: string;
  trainingProgram: string;
  programCompletionDate: string;
  organizationName: string; // optional, "" when not given
  organizationLicenseNumber: string; // optional, "" when not given
  imageKey: string; // storage key, never sent to the browser
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Validated query of GET /api/admin/akama (see adminList in akama.validation.ts). */
export type TAdminAkamaQuery = {
  search?: string;
  visibility: "all" | "public" | "private";
  from?: string; // ISO date-time
  to?: string; // ISO date-time
  sort: "newest" | "oldest";
  page: number;
  limit: number;
};

/** Validated query of GET /api/public/akama (see publicList in akama.validation.ts). */
export type TPublicAkamaQuery = {
  search?: string;
  page: number;
  limit: number;
};
