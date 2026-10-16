/**
 * Akama business logic: database queries, image handling and the shapes of
 * the data sent to the browser. Called by akama.routes.ts.
 *
 * Privacy rule: the public functions (listPublic, getPublic) always include
 * `isPublic: true` in the database query itself, so a private record can never
 * be returned to a visitor – not even briefly.
 */
import httpStatus from "http-status";
import { FilterQuery } from "mongoose";
import config from "../../config";
import AppError from "../../error/AppError";
import { deleteImageSafely, verifyUploadedImage } from "../../utils/imageStorage";
import { IAkama, TAdminAkamaQuery, TPublicAkamaQuery } from "./akama.interface";
import { AkamaModel } from "./akama.model";

const NOT_FOUND = "Akama record not found";

// ================= Helpers =================

// Makes user text safe to use inside a regular expression ("a.b" matches "a.b", not "axb")
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches part of the name (any case) or part of the record ID
const searchFilter = (search?: string): FilterQuery<IAkama> => {
  const term = search?.trim();
  if (!term) return {};
  const or: FilterQuery<IAkama>[] = [
    { name: { $regex: escapeRegex(term), $options: "i" } },
    { certificateNumber: { $regex: escapeRegex(term), $options: "i" } },
    { identityNumber: { $regex: escapeRegex(term), $options: "i" } },
  ];
  // Looks like (part of) an ID? Also compare against the ID as text.
  if (/^[a-f0-9]{4,24}$/i.test(term)) {
    or.push({
      $expr: {
        $regexMatch: { input: { $toString: "$_id" }, regex: term.toLowerCase() },
      },
    });
  }
  return { $or: or };
};

// Paging info returned with every list (used by the table / directory pagination)
const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

// Changes whenever the record is saved; added to image URLs (?v=...) so the
// browser fetches the new picture after an image replacement.
const version = (doc: IAkama) => new Date(doc.updatedAt).getTime();

/** Canonical, permanent public URL of a record. Depends only on the ID.
 *  Must match the website page Client/app/akama/[id]/page.tsx. */
export const publicUrlFor = (id: string) => `${config.public_app_url}/akama/${id}`;

/** Everything the admin panel needs about a record. */
export const toAdminAkama = (doc: IAkama) => {
  const id = doc._id.toString();
  return {
    id,
    name: doc.name,
    certificateNumber: doc.certificateNumber,
    issueDate: doc.issueDate,
    expiryDate: doc.expiryDate,
    identityNumber: doc.identityNumber,
    gender: doc.gender,
    nationality: doc.nationality,
    profession: doc.profession,
    trainingProgram: doc.trainingProgram,
    programCompletionDate: doc.programCompletionDate,
    organizationName: doc.organizationName,
    organizationLicenseNumber: doc.organizationLicenseNumber,
    isPublic: doc.isPublic,
    publicUrl: publicUrlFor(id), // shown in admin + encoded in the QR code
    imageUrl: `/api/admin/card/${id}/image?v=${version(doc)}`,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// Only what a visitor needs. Never call this for a private record.
export const toPublicAkama = (doc: IAkama) => {
  const id = doc._id.toString();
  return {
    id,
    name: doc.name,
    certificateNumber: doc.certificateNumber,
    issueDate: doc.issueDate,
    expiryDate: doc.expiryDate,
    identityNumber: doc.identityNumber,
    gender: doc.gender,
    nationality: doc.nationality,
    profession: doc.profession,
    trainingProgram: doc.trainingProgram,
    programCompletionDate: doc.programCompletionDate,
    organizationName: doc.organizationName,
    organizationLicenseNumber: doc.organizationLicenseNumber,
    imageUrl: `/api/public/card/${id}/image?v=${version(doc)}`,
  };
};

// ================= Public (only isPublic: true is ever queried) =================

/** Public directory: newest first, optional search. */
const listPublic = async ({ search, page, limit }: TPublicAkamaQuery) => {
  // isPublic is set last so a search filter can never override it
  const filter: FilterQuery<IAkama> = { ...searchFilter(search), isPublic: true };
  // Run the page query and the total count at the same time
  const [docs, total] = await Promise.all([
    AkamaModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<IAkama[]>(),
    AkamaModel.countDocuments(filter),
  ]);
  return { items: docs.map(toPublicAkama), meta: paginate(page, limit, total) };
};

/** One public record. Private and missing records both give the same 404. */
const getPublic = async (id: string) => {
  const doc = await AkamaModel.findOne({ _id: id, isPublic: true }).lean<IAkama>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  return doc;
};

// ================= Admin =================

/** Admin table: search + visibility + date range + sort + paging. */
const listAdmin = async (query: TAdminAkamaQuery) => {
  const { search, visibility, from, to, sort, page, limit } = query;
  const filter: FilterQuery<IAkama> = searchFilter(search);
  // "all" = no visibility filter
  if (visibility !== "all") filter.isPublic = visibility === "public";
  // Creation date range (either end may be missing)
  if (from || to) {
    filter.createdAt = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }
  // _id as a tie-breaker keeps the order stable between pages
  const direction = sort === "oldest" ? 1 : -1;
  const [docs, total] = await Promise.all([
    AkamaModel.find(filter)
      .sort({ createdAt: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<IAkama[]>(),
    AkamaModel.countDocuments(filter),
  ]);
  return { items: docs.map(toAdminAkama), meta: paginate(page, limit, total) };
};

/** Dashboard counters. */
const stats = async () => {
  const [total, publicCount] = await Promise.all([
    AkamaModel.countDocuments(),
    AkamaModel.countDocuments({ isPublic: true }),
  ]);
  return { total, public: publicCount, private: total - publicCount };
};

/** One record, any visibility (admin only). */
const getAdmin = async (id: string) => {
  const doc = await AkamaModel.findById(id).lean<IAkama>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  return doc;
};

/** Saves the image first, then the record. MongoDB generates the permanent ID. */
// The browser has already uploaded the image to S3 (presigned URL); make sure the
// key really points at a valid image before a record may use it.
const resolveImageKey = async (input: { imageKey?: string }) => {
  if (!input.imageKey) return undefined;
  await verifyUploadedImage(input.imageKey);
  return input.imageKey;
};

const create = async (input: {
  name: string;
  certificateNumber: string; issueDate: string; expiryDate: string; identityNumber: string;
  gender: string; nationality: string; profession: string; trainingProgram: string;
  programCompletionDate: string; organizationName?: string; organizationLicenseNumber?: string;
  isPublic: boolean;
  imageKey?: string;
}) => {
  const imageKey = await resolveImageKey(input); // validates type/size too
  if (!imageKey) throw new AppError(httpStatus.BAD_REQUEST, "Please choose an Akama image.");
  try {
    const doc = await AkamaModel.create({
      name: input.name,
      certificateNumber: input.certificateNumber,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      identityNumber: input.identityNumber,
      gender: input.gender,
      nationality: input.nationality,
      profession: input.profession,
      trainingProgram: input.trainingProgram,
      programCompletionDate: input.programCompletionDate,
      // Optional fields: stored as "" when left empty
      organizationName: input.organizationName ?? "",
      organizationLicenseNumber: input.organizationLicenseNumber ?? "",
      isPublic: input.isPublic,
      imageKey,
    });
    return toAdminAkama(doc.toObject());
  } catch (error) {
    // Record could not be saved -> don't leave an unused image behind
    await deleteImageSafely(imageKey);
    throw error;
  }
};

/** Edits name / visibility / image. The ID never changes, so links and QR codes keep working. */
const update = async (
  id: string,
  input: Partial<Pick<IAkama, "name" | "certificateNumber" | "issueDate" | "expiryDate" | "identityNumber" | "gender" | "nationality" | "profession" | "trainingProgram" | "programCompletionDate" | "organizationName" | "organizationLicenseNumber">> & { isPublic?: boolean; imageKey?: string },
) => {
  const doc = await AkamaModel.findById(id);
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  if (!Object.keys(input).some(key => input[key as keyof typeof input] !== undefined)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Nothing to update.");
  }

  // Store the new image (if any) before touching the record
  const newKey = await resolveImageKey(input);
  const oldKey = doc.imageKey;
  for (const key of ["name", "certificateNumber", "issueDate", "expiryDate", "identityNumber", "gender", "nationality", "profession", "trainingProgram", "programCompletionDate", "organizationName", "organizationLicenseNumber", "isPublic"] as const) {
    if (input[key] !== undefined) (doc as any)[key] = input[key];
  }
  if (newKey) doc.imageKey = newKey;

  try {
    await doc.save();
  } catch (error) {
    // Save failed -> the record still points at the old image; drop the new one
    await deleteImageSafely(newKey);
    throw error;
  }
  // Only remove the old image once the record points at the new one
  if (newKey) await deleteImageSafely(oldKey);
  return toAdminAkama(doc.toObject());
};

/** Make Public / Make Private. Takes effect immediately on the public pages. */
const setVisibility = async (id: string, isPublic: boolean) => {
  const doc = await AkamaModel.findByIdAndUpdate(
    id,
    { isPublic },
    { new: true }, // return the updated record
  ).lean<IAkama>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  return toAdminAkama(doc);
};

/** Deletes the record first, then its image. */
const remove = async (id: string) => {
  const doc = await AkamaModel.findByIdAndDelete(id).lean<IAkama>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  // The record is already gone; a failed file delete is only logged.
  await deleteImageSafely(doc.imageKey);
  return { id };
};

export const AkamaService = {
  listPublic,
  getPublic,
  listAdmin,
  stats,
  getAdmin,
  create,
  update,
  setVisibility,
  remove,
};
