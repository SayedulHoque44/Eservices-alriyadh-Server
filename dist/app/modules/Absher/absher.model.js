"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsherModel = void 0;
/**
 * Absher account (MongoDB collection "abshers").
 *
 * One flat document per person: login (resident ID + PIN), two images and the
 * text details shown in the app. Not shared publicly – no public page, no QR code.
 */
const mongoose_1 = require("mongoose");
// Optional text field: trimmed, "" when not given
const text = (maxlength) => ({ type: String, trim: true, maxlength, default: "" });
const absherSchema = new mongoose_1.Schema({
    // ----- Account (login) -----
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // App login ID – unique, so two accounts can never share it
    residentId: { type: String, required: true, trim: true, maxlength: 20, unique: true },
    // App login PIN, stored as typed so the admin can look it up
    pin: { type: String, required: true, trim: true, maxlength: 20 },
    // ----- Images (S3 keys, only served through the API) -----
    // Attached right after the account is created (see AbsherFormModal), so "" at first
    photoKey: { type: String, default: "" },
    cardKey: { type: String, default: "" },
    // ----- Personal Details -----
    nationality: text(80),
    birthCity: text(80),
    birthCountry: text(80),
    dateOfBirth: text(40),
    maritalStatus: text(40),
    sponsorshipTransfers: text(10),
    religion: text(40),
    workPermit: text(80),
    biometricsCollected: text(20),
    travelStatus: text(40),
    // ----- Sponsor Details -----
    sponsorName: text(160),
    sponsorId: text(40),
    // ----- Health Insurance -----
    insuranceIssueDate: text(40),
    insuranceExpiryDate: text(40),
    bloodType: text(10),
    // ----- Passport -----
    amountDeposit: text(40),
    passportNumber: text(40),
    passportType: text(40),
    passportIssueDate: text(40),
    passportExpiryDate: text(40),
    passportIssueCity: text(80),
    passportStatus: text(40),
    // ----- Resident ID card -----
    idVersion: text(10),
    idIssueDate: text(40),
    idExpiryDate: text(40),
}, { timestamps: true });
// Speeds up the admin table sorting and date filter
absherSchema.index({ createdAt: -1 });
exports.AbsherModel = (0, mongoose_1.model)("Absher", absherSchema, "abshers");
