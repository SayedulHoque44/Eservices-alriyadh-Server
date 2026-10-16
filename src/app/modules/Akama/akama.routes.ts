/**
 * Akama HTTP routes. Two routers are exported and mounted in app/routes/index.ts:
 *
 * PUBLIC – /api/public/akama (no login; only ever returns public records)
 *   GET  /              list + search public records        -> /akama directory page
 *   GET  /:id           one public record                   -> /akama/{id} page
 *   GET  /:id/image     the image, if the record is public
 *
 * ADMIN – /api/admin/akama (login required for every route)
 *   GET    /                list with search, filters, sort, paging
 *   GET    /stats           total / public / private counts
 *   POST   /upload-url      presigned PUT URL for a direct browser -> S3 upload
 *   POST   /                create (JSON: name, isPublic, imageKey)
 *   GET    /:id             one record
 *   GET    /:id/image       the image (any visibility)
 *   GET    /:id/qr          QR code PNG of the permanent public URL (?download=1 to save)
 *   PATCH  /:id             edit name / image / visibility (JSON, imageKey optional)
 *   PATCH  /:id/visibility  make public or private (JSON)
 *   DELETE /:id             delete record and its image
 *
 * Business logic lives in akama.service.ts; this file handles HTTP details
 * (caching headers, streaming, status codes).
 */
import crypto from "crypto";
import express, { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { isValidObjectId } from "mongoose";
import QRCode from "qrcode";
import auth from "../../../middlewares/auth";
import validateRequest from "../../../middlewares/validateRequest";
import AppError from "../../error/AppError";
import catchAsync from "../../utils/catchAsync";
import { createUploadTarget, readImage } from "../../utils/imageStorage";
import sendResponse from "../../utils/sendResponse";
import { IAkama, TAdminAkamaQuery, TPublicAkamaQuery } from "./akama.interface";
import { AkamaService, publicUrlFor, toAdminAkama, toPublicAkama } from "./akama.service";
import { AkamaValidation } from "./akama.validation";

// ================= Shared helpers =================

// Runs for every route with ":id". Invalid IDs are reported exactly like
// missing records (404), so the response never hints at what exists.
const checkId = (req: Request, res: Response, next: NextFunction, id: string) => {
  if (!isValidObjectId(id) || !/^[a-f0-9]{24}$/i.test(id)) {
    return next(new AppError(httpStatus.NOT_FOUND, "Akama record not found"));
  }
  next();
};

// Responses must never be reused after a record changes visibility
const noStore = (req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
};

/**
 * Streams the image. "private, no-cache" lets the browser keep a copy but forces it
 * to ask the server again each time, so a record made private stops loading at once.
 */
const sendImage = async (req: Request, res: Response, doc: IAkama) => {
  // ETag = fingerprint of the stored file. If the browser already has this exact
  // file it gets a quick 304 "Not Modified" – but only after the visibility check
  // done by the caller, so a private record still gets 404.
  const etag = `"${crypto.createHash("sha1").update(doc.imageKey).digest("hex")}"`;
  res.set({
    "Cache-Control": "private, no-cache",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (req.headers["if-none-match"] === etag) {
    res.status(httpStatus.NOT_MODIFIED).end();
    return;
  }

  let image;
  try {
    image = await readImage(doc.imageKey);
  } catch {
    throw new AppError(httpStatus.NOT_FOUND, "Image not found");
  }
  res.type(image.contentType);
  // Pipe the file straight to the response without loading it all into memory
  image.body.on("error", () => res.destroy());
  image.body.pipe(res);
};

// ================= Public: /api/public/akama =================
const publicRouter = express.Router();
publicRouter.param("id", checkId);

// Public directory list (search + paging). Service only queries isPublic: true.
publicRouter.get(
  "/",
  noStore,
  validateRequest(AkamaValidation.publicList),
  catchAsync(async (req, res) => {
    const result = await AkamaService.listPublic(req.query as unknown as TPublicAkamaQuery);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: result });
  }),
);

// One public record (404 if private or missing). Returns only id, name, imageUrl.
publicRouter.get(
  "/:id",
  noStore,
  catchAsync(async (req, res) => {
    const doc = await AkamaService.getPublic(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: toPublicAkama(doc) });
  }),
);

// Public image – visibility is checked on every single request
publicRouter.get(
  "/:id/image",
  catchAsync(async (req, res) => {
    const doc = await AkamaService.getPublic(req.params.id);
    await sendImage(req, res, doc);
  }),
);

// ================= Admin: /api/admin/akama (login required) =================
const adminRouter = express.Router();
// Every admin route: must be logged in, and responses are never cached
adminRouter.use(auth(), noStore);
adminRouter.param("id", checkId);

// Records table (search, visibility, date range, sort, paging)
adminRouter.get(
  "/",
  validateRequest(AkamaValidation.adminList),
  catchAsync(async (req, res) => {
    const result = await AkamaService.listAdmin(req.query as unknown as TAdminAkamaQuery);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: result });
  }),
);

// Dashboard counters. Declared before "/:id" so "stats" is not read as an ID.
adminRouter.get(
  "/stats",
  catchAsync(async (req, res) => {
    const result = await AkamaService.stats();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: result });
  }),
);

// Step 1 of a direct upload: validate the announced file, return { presignedUrl, Key }.
// Declared before "/:id" routes so "upload-url" is never read as an ID.
adminRouter.post(
  "/upload-url",
  validateRequest(AkamaValidation.uploadUrl),
  catchAsync(async (req, res) => {
    const { fileName, fileType, fileSize, folderName } = req.body;
    const data = await createUploadTarget({ fileName, fileType, fileSize, folderName });
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Presigned URL created successfully!",
      data,
    });
  }),
);

// Create: validate fields -> verify the uploaded S3 image -> save record
adminRouter.post(
  "/",
  validateRequest(AkamaValidation.create),
  catchAsync(async (req, res) => {
    const result = await AkamaService.create(req.body);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Akama record created",
      data: result,
    });
  }),
);

// One record (any visibility)
adminRouter.get(
  "/:id",
  catchAsync(async (req, res) => {
    const doc = await AkamaService.getAdmin(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: toAdminAkama(doc) });
  }),
);

// Image for the admin table/details (works for private records too)
adminRouter.get(
  "/:id/image",
  catchAsync(async (req, res) => {
    const doc = await AkamaService.getAdmin(req.params.id);
    await sendImage(req, res, doc);
  }),
);

// QR code for the record's permanent public URL. Generated on request from the
// ID, so it never needs regenerating or storing, and survives name/image edits.
adminRouter.get(
  "/:id/qr",
  catchAsync(async (req, res) => {
    const doc = await AkamaService.getAdmin(req.params.id);
    const id = doc._id.toString();
    const png = await QRCode.toBuffer(publicUrlFor(id), {
      type: "png",
      errorCorrectionLevel: "M", // still scans if ~15% is damaged/dirty
      width: 1024, // sharp when printed
      margin: 4, // standard quiet zone for reliable scanning
      color: { dark: "#000000", light: "#ffffff" }, // maximum contrast
    });
    res.set("Content-Type", "image/png");
    // ?download=1 -> browser saves the file instead of showing it
    if (req.query.download) {
      // File name from the person's name, reduced to safe characters
      const safeName = doc.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "akama";
      res.attachment(`akama-qr-${safeName}-${id}.png`);
    }
    res.send(png);
  }),
);

// Edit: any of name / image / visibility. The ID (and so the URL and QR) never changes.
adminRouter.patch(
  "/:id",
  validateRequest(AkamaValidation.update),
  catchAsync(async (req, res) => {
    const result = await AkamaService.update(req.params.id, req.body);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Changes saved",
      data: result,
    });
  }),
);

// Make Public / Make Private buttons
adminRouter.patch(
  "/:id/visibility",
  validateRequest(AkamaValidation.visibility),
  catchAsync(async (req, res) => {
    const result = await AkamaService.setVisibility(req.params.id, req.body.isPublic);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.isPublic ? "Record is now public" : "Record is now private",
      data: result,
    });
  }),
);

// Delete record, then its image
adminRouter.delete(
  "/:id",
  catchAsync(async (req, res) => {
    const result = await AkamaService.remove(req.params.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Akama record deleted",
      data: result,
    });
  }),
);

export const PublicAkamaRoutes = publicRouter;
export const AdminAkamaRoutes = adminRouter;
