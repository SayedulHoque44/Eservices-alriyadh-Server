import express, { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { isValidObjectId } from "mongoose";
import QRCode from "qrcode";
import auth from "../../../middlewares/auth";
import validateRequest from "../../../middlewares/validateRequest";
import AppError from "../../error/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TEmployeePermitQuery } from "./employeePermit.interface";
import { employeePermitUrl, EmployeePermitService, toEmployeePermit } from "./employeePermit.service";
import { EmployeePermitValidation } from "./employeePermit.validation";
const checkId = (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!isValidObjectId(id)) return next(new AppError(httpStatus.NOT_FOUND, "Employee permit not found"));
  next();
};
const publicRouter = express.Router();
publicRouter.get("/:userId", catchAsync(async (req, res) => {
  const record = await EmployeePermitService.getPublic(req.params.userId);
  res.set("Cache-Control", "no-store");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, data: toEmployeePermit(record) });
}));
const adminRouter = express.Router();
adminRouter.use(auth(), (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
adminRouter.param("id", checkId);
adminRouter.get("/", validateRequest(EmployeePermitValidation.adminList), catchAsync(async (req, res) => {
  const data = await EmployeePermitService.list(req.query as unknown as TEmployeePermitQuery);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, data });
}));
adminRouter.post("/", validateRequest(EmployeePermitValidation.create), catchAsync(async (req, res) => {
  const data = await EmployeePermitService.create(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Employee permit created", data });
}));
adminRouter.get("/:id/qr", catchAsync(async (req, res) => {
  const record = await EmployeePermitService.getAdmin(req.params.id);
  const png = await QRCode.toBuffer(employeePermitUrl(record.userId), { type: "png", errorCorrectionLevel: "M", width: 768, margin: 3 });
  res.type("png");
  if (req.query.download === "1") res.attachment(`employee-permit-${record.userId}-qr.png`);
  res.send(png);
}));
adminRouter.get("/:id", catchAsync(async (req, res) => {
  const data = await EmployeePermitService.getAdmin(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, data: toEmployeePermit(data) });
}));
adminRouter.patch("/:id", validateRequest(EmployeePermitValidation.update), catchAsync(async (req, res) => {
  const data = await EmployeePermitService.update(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Changes saved", data });
}));
adminRouter.delete("/:id", catchAsync(async (req, res) => {
  const data = await EmployeePermitService.remove(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Employee permit deleted", data });
}));
export const PublicEmployeePermitRoutes = publicRouter;
export const AdminEmployeePermitRoutes = adminRouter;

