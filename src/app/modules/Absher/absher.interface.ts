/**
 * TypeScript types for the Absher module.
 */
import { Types } from "mongoose";

/**
 * Text details of an Absher account – everything the admin types in.
 * Stored flat (one field each); the nested sections the app shows are built
 * from these in absher.service.ts (toAppAbsher).
 */
export interface IAbsherDetails {
  // ----- Account (login) -----
  name: string;
  residentId: string; // Resident ID number = the app login ID ("id" in the app data)

  // ----- Personal Details -----
  nationality: string;
  birthCity: string;
  birthCountry: string;
  dateOfBirth: string;
  maritalStatus: string;
  sponsorshipTransfers: string;
  religion: string;
  workPermit: string;
  biometricsCollected: string;
  travelStatus: string;

  // ----- Sponsor Details -----
  sponsorName: string;
  sponsorId: string;

  // ----- Health Insurance -----
  insuranceIssueDate: string;
  insuranceExpiryDate: string;
  bloodType: string;

  // ----- Passport -----
  amountDeposit: string;
  passportNumber: string;
  passportType: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssueCity: string;
  passportStatus: string;

  // ----- Resident ID card -----
  idVersion: string;
  idIssueDate: string;
  idExpiryDate: string;
}

/** A stored Absher account (see absher.model.ts). */
export interface IAbsher extends IAbsherDetails {
  _id: Types.ObjectId;
  pin: string; // app login PIN (stored as typed, shown only in the admin panel)
  photoKey: string; // storage key of the profile photo ("" until the photo is attached)
  cardKey: string; // storage key of the Absher card image ("" when not uploaded)
  createdAt: Date;
  updatedAt: Date;
}

/** Validated query of GET /api/admin/absher (see adminList in absher.validation.ts). */
export type TAdminAbsherQuery = {
  search?: string;
  from?: string; // ISO date-time
  to?: string; // ISO date-time
  sort: "newest" | "oldest";
  page: number;
  limit: number;
};
