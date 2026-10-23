/**
 * Absher HTTP routes. Two routers are exported and mounted in app/routes/index.ts:
 *
 * APP – /api/app/absher (the mobile app)
 *   POST /login        { id, pin } -> { user: full details }
 *   One call, no token. Image links in the response are signed S3 URLs (1 hour).
 *
 * ADMIN – /api/admin/absher (admin login required for every route)
 *   GET    /             list with search, date filter, sort, paging
 *   GET    /stats        total count
 *   POST   /             create (JSON: details + pin; images are attached afterwards with PATCH)
 *   GET    /:id          one account
 *   PATCH  /:id          edit any field, including the login ID and PIN
 *   DELETE /:id          delete account and its images
 *
 * Images are uploaded with the shared POST /api/admin/akama/upload-url step
 * (folder "eservices-alriyadh/absher"); only their full keys are stored and they
 * are shown through the CloudFront CDN (<CDN base URL>/<key>). No public page, no QR code.
 * Business logic lives in absher.service.ts; this file handles HTTP details.
 */
import express, { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { isValidObjectId } from "mongoose";
import auth from "../../../middlewares/auth";
import validateRequest from "../../../middlewares/validateRequest";
import AppError from "../../error/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TAdminAbsherQuery } from "./absher.interface";
import { AbsherService, toAdminAbsher } from "./absher.service";
import { AbsherValidation } from "./absher.validation";

// ================= Shared helpers =================

// Runs for every route with ":id". Invalid IDs are reported exactly like
// missing accounts (404), so the response never hints at what exists.
const checkId = (req: Request, res: Response, next: NextFunction, id: string) => {
  if (!isValidObjectId(id) || !/^[a-f0-9]{24}$/i.test(id)) {
    return next(new AppError(httpStatus.NOT_FOUND, "Absher account not found"));
  }
  next();
};

// Personal data: responses must never be stored by browsers or proxies
const noStore = (req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
};

// ================= App: /api/app/absher =================
const appRouter = express.Router();
appRouter.use(noStore);

// Login: validated -> the user's full details
appRouter.post(
  "/login",
  validateRequest(AbsherValidation.appLogin),
  catchAsync(async (req, res) => {
    const result = await AbsherService.appLogin(req.body.id, req.body.pin);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Logged in successfully", data: result });
  }),
);

// ================= Admin: /api/admin/absher (login required) =================
const adminRouter = express.Router();
// Every admin route: must be logged in, and responses are never cached
adminRouter.use(auth(), noStore);
adminRouter.param("id", checkId);

// Accounts table (search, date range, sort, paging)
adminRouter.get(
  "/",
  validateRequest(AbsherValidation.adminList),
  catchAsync(async (req, res) => {
    const result = await AbsherService.listAdmin(req.query as unknown as TAdminAbsherQuery);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: result });
  }),
);

// Dashboard counter. Declared before "/:id" so "stats" is not read as an ID.
adminRouter.get(
  "/stats",
  catchAsync(async (req, res) => {
    const result = await AbsherService.stats();
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: result });
  }),
);

// Create: validate fields -> verify the uploaded images -> save account
adminRouter.post(
  "/",
  validateRequest(AbsherValidation.create),
  catchAsync(async (req, res) => {
    const result = await AbsherService.create(req.body);
    sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Absher account created", data: result });
  }),
);

// One account
adminRouter.get(
  "/:id",
  catchAsync(async (req, res) => {
    const doc = await AbsherService.getAdmin(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, data: toAdminAbsher(doc) });
  }),
);

// Edit: any field. Only the fields sent are changed.
adminRouter.patch(
  "/:id",
  validateRequest(AbsherValidation.update),
  catchAsync(async (req, res) => {
    const result = await AbsherService.update(req.params.id, req.body);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Changes saved", data: result });
  }),
);

// Delete account, then its images
adminRouter.delete(
  "/:id",
  catchAsync(async (req, res) => {
    const result = await AbsherService.remove(req.params.id);
    sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Absher account deleted", data: result });
  }),
);

export const AppAbsherRoutes = appRouter;
export const AdminAbsherRoutes = adminRouter;
