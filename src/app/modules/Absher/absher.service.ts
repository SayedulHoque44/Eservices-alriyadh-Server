/**
 * Absher business logic: database queries, PIN + app login, image handling and
 * the shapes of the data sent out. Called by absher.routes.ts.
 *
 * Two kinds of callers:
 *   - admin panel  -> toAdminAbsher (flat fields incl. PIN and image keys)
 *   - mobile app   -> toAppAbsher (nested sections the app renders, never the PIN)
 *
 * Images: the database stores the full S3 key ("<folder>/<file>", e.g.
 * "eservices-alriyadh/absher/1792760514931_profile.png"). They are shown through
 * the CloudFront CDN as <CDN base URL>/<key> – the website builds that URL itself
 * from NEXT_PUBLIC_AWS_IMAGES_CDN_BASE_URL; the app gets it ready-made.
 */
import httpStatus from "http-status";
import { FilterQuery } from "mongoose";
import config from "../../config";
import AppError from "../../error/AppError";
import { deleteImageSafely, verifyUploadedImage } from "../../utils/imageStorage";
import { IAbsher, IAbsherDetails, TAdminAbsherQuery } from "./absher.interface";
import { AbsherModel } from "./absher.model";

const NOT_FOUND = "Absher account not found";
const DUPLICATE_ID = "An Absher account with this Resident ID number already exists.";

/** Every text detail key, in one list (used by create/update loops). */
const DETAIL_KEYS = [
  "name", "residentId",
  "nationality", "birthCity", "birthCountry", "dateOfBirth", "maritalStatus", "sponsorshipTransfers",
  "religion", "workPermit", "biometricsCollected", "travelStatus",
  "sponsorName", "sponsorId",
  "insuranceIssueDate", "insuranceExpiryDate", "bloodType",
  "amountDeposit", "passportNumber", "passportType", "passportIssueDate", "passportExpiryDate",
  "passportIssueCity", "passportStatus",
  "idVersion", "idIssueDate", "idExpiryDate",
] as const satisfies readonly (keyof IAbsherDetails)[];

// ================= Helpers =================

// Makes user text safe to use inside a regular expression ("a.b" matches "a.b", not "axb")
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches part of the name, resident ID, passport number or sponsor ID (any case)
const searchFilter = (search?: string): FilterQuery<IAbsher> => {
  const term = search?.trim();
  if (!term) return {};
  const regex = { $regex: escapeRegex(term), $options: "i" };
  return {
    $or: [{ name: regex }, { residentId: regex }, { passportNumber: regex }, { sponsorId: regex }],
  };
};

// Paging info returned with every list (used by the table pagination)
const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});


// The browser has already uploaded the image to S3 (presigned URL); make sure the
// key really points at a valid image before an account may use it.
const resolveImageKey = async (key?: string) => {
  if (!key) return undefined;
  await verifyUploadedImage(key);
  return key;
};

// Unique index would reject it anyway; checking first gives a clear message
const assertIdFree = async (residentId: string, exceptId?: string) => {
  const filter: FilterQuery<IAbsher> = { residentId };
  if (exceptId) filter._id = { $ne: exceptId };
  if (await AbsherModel.exists(filter)) throw new AppError(httpStatus.CONFLICT, DUPLICATE_ID);
};

// ================= Output shapes =================

/** Everything the admin panel needs about an account (including the PIN). */
export const toAdminAbsher = (doc: IAbsher) => {
  const id = doc._id.toString();
  const details = Object.fromEntries(DETAIL_KEYS.map(key => [key, doc[key] ?? ""])) as unknown as IAbsherDetails;
  return {
    id,
    ...details,
    pin: doc.pin,
    // Full S3 keys; the website shows them as NEXT_PUBLIC_AWS_IMAGES_CDN_BASE_URL + "/" + key
    photoKey: doc.photoKey,
    cardKey: doc.cardKey, // "" = no card image uploaded
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// Empty values are shown as "-" in the app
const show = (value?: string) => value?.trim() || "-";

// Arabic text in a value -> the app renders it right-to-left
const hasArabic = (value: string) => /[\u0600-\u06FF]/.test(value);

/** One label/value row in the app. `copy` = the app shows a copy button. */
const row = (label: string, value: string | undefined, copy = false) => {
  const shown = show(value);
  return {
    label,
    value: shown,
    ...(hasArabic(shown) && { lang: "ar" }),
    ...(copy && { copy: true }),
  };
};

// Public CDN address of a stored image: <AWS_IMAGES_CDN_BASE_URL>/<key>
const cdnUrl = (key: string) => `${config.aws_images_cdn_base_url}/${key}`;

/**
 * The account in the nested shape the mobile app renders (sections + rows).
 * Built on the fly from the flat document – nothing nested is stored.
 * photo / absher_card are full CDN URLs the app can show directly.
 */
export const toAppAbsher = (doc: IAbsher) => ({
  user: {
    name: doc.name,
    id: doc.residentId,
    photo: doc.photoKey ? cdnUrl(doc.photoKey) : null,
    absher_card: doc.cardKey ? cdnUrl(doc.cardKey) : null,
    personal: {
      sections: [
        {
          title: "Personal Details",
          rows: [
            row("Name", doc.name),
            row("Nationality", doc.nationality),
            row("Birth City", doc.birthCity),
            row("Birth Country/Region", doc.birthCountry),
            row("Date of Birth", doc.dateOfBirth),
            row("Marital Status", doc.maritalStatus),
            row("No. of sponsorship transfers", doc.sponsorshipTransfers),
            row("Religion", doc.religion),
            row("Work Permit", doc.workPermit),
            row("Biometrics Collected", doc.biometricsCollected),
            row("Travel Status", doc.travelStatus),
          ],
        },
        {
          title: "Sponsor Details",
          rows: [row("Sponsor Name", doc.sponsorName), row("Sponsor ID Number", doc.sponsorId, true)],
        },
        {
          title: "Health Insurance",
          rows: [
            row("Issuing Date", doc.insuranceIssueDate),
            row("Expiry Date", doc.insuranceExpiryDate),
            row("Blood Type", doc.bloodType),
          ],
        },
      ],
    },
    passport: {
      amountDepositLabel: "Amount deposit",
      amountDeposit: show(doc.amountDeposit),
      // e.g. "Normal Passport" (from the passport type)
      sectionTitle: `${doc.passportType?.trim() || "Normal"} Passport`,
      rows: [
        row("Passport Number", doc.passportNumber, true),
        row("Type", doc.passportType),
        row("Issuing Date", doc.passportIssueDate),
        row("Expiry Date", doc.passportExpiryDate),
        row("Issuing City", doc.passportIssueCity),
        row("Status", doc.passportStatus),
      ],
    },
    residentId: {
      cardTitle: "My Resident ID",
      rows: [
        row("Resident ID Number", doc.residentId, true),
        row("ID Version", doc.idVersion),
        row("Issuing Date", doc.idIssueDate),
        row("Expiry Date", doc.idExpiryDate),
      ],
    },
  },
});

// ================= Admin =================

/** Admin table: search + date range + sort + paging. */
const listAdmin = async ({ search, from, to, sort, page, limit }: TAdminAbsherQuery) => {
  const filter: FilterQuery<IAbsher> = searchFilter(search);
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
    AbsherModel.find(filter)
      .sort({ createdAt: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<IAbsher[]>(),
    AbsherModel.countDocuments(filter),
  ]);
  return { items: docs.map(toAdminAbsher), meta: paginate(page, limit, total) };
};

/** Dashboard counter. */
const stats = async () => ({ total: await AbsherModel.countDocuments() });

/** One account (admin only). */
const getAdmin = async (id: string) => {
  const doc = await AbsherModel.findById(id).lean<IAbsher>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  return doc;
};

type TSaveInput = Partial<IAbsherDetails> & { pin?: string; photoKey?: string; cardKey?: string };

/**
 * New account. The admin panel creates it with the text details only and then
 * attaches the images (update), so nothing is uploaded unless this succeeds.
 * Image keys are still accepted here for other callers; any failure deletes them.
 */
const create = async (input: TSaveInput & { name: string; residentId: string; pin: string }) => {
  let photoKey: string | undefined;
  let cardKey: string | undefined;
  try {
    await assertIdFree(input.residentId);
    photoKey = await resolveImageKey(input.photoKey);
    cardKey = await resolveImageKey(input.cardKey);
    const details = Object.fromEntries(DETAIL_KEYS.map(key => [key, input[key] ?? ""]));
    const doc = await AbsherModel.create({
      ...details,
      pin: input.pin,
      photoKey: photoKey ?? "",
      cardKey: cardKey ?? "",
    });
    return toAdminAbsher(doc.toObject());
  } catch (error) {
    // Account could not be saved -> don't leave unused images behind
    await deleteImageSafely(input.photoKey);
    await deleteImageSafely(input.cardKey);
    throw error;
  }
};

/** Edits any field (including the login ID and PIN). */
const update = async (id: string, input: TSaveInput) => {
  const doc = await AbsherModel.findById(id);
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  if (!Object.keys(input).some(key => input[key as keyof TSaveInput] !== undefined)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Nothing to update.");
  }
  if (input.residentId && input.residentId !== doc.residentId) await assertIdFree(input.residentId, id);

  // Store the new images (if any) before touching the account
  const newPhoto = await resolveImageKey(input.photoKey);
  let newCard: string | undefined;
  try {
    newCard = await resolveImageKey(input.cardKey);
  } catch (error) {
    await deleteImageSafely(newPhoto);
    throw error;
  }
  const oldPhoto = doc.photoKey;
  const oldCard = doc.cardKey;

  for (const key of DETAIL_KEYS) {
    if (input[key] !== undefined) doc[key] = input[key] as string;
  }
  if (input.pin) doc.pin = input.pin;
  if (newPhoto) doc.photoKey = newPhoto;
  if (newCard) doc.cardKey = newCard;

  try {
    await doc.save();
  } catch (error) {
    // Save failed -> the account still points at the old images; drop the new ones
    await deleteImageSafely(newPhoto);
    await deleteImageSafely(newCard);
    throw error;
  }
  // Only remove old images once the account points at the new ones
  if (newPhoto) await deleteImageSafely(oldPhoto);
  if (newCard) await deleteImageSafely(oldCard);
  return toAdminAbsher(doc.toObject());
};

/** Deletes the account first, then its images. The person can no longer log in. */
const remove = async (id: string) => {
  const doc = await AbsherModel.findByIdAndDelete(id).lean<IAbsher>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND);
  // The account is already gone; a failed file delete is only logged.
  await deleteImageSafely(doc.photoKey);
  await deleteImageSafely(doc.cardKey);
  return { id };
};

// ================= Mobile app =================

/**
 * App login: resident ID + PIN -> the user's full details (nested app shape).
 * One call, no token: the app keeps the returned data and calls this again to refresh.
 */
const appLogin = async (residentId: string, pin: string) => {
  const doc = await AbsherModel.findOne({ residentId }).lean<IAbsher>();
  // Same message for "wrong ID" and "wrong PIN" (don't reveal which)
  if (!doc || doc.pin !== pin) throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect ID or PIN.");
  return toAppAbsher(doc);
};

export const AbsherService = {
  listAdmin,
  stats,
  getAdmin,
  create,
  update,
  remove,
  appLogin,
};
