"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminEmployeePermitRoutes = exports.PublicEmployeePermitRoutes = void 0;
const express_1 = __importDefault(require("express"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const qrcode_1 = __importDefault(require("qrcode"));
const auth_1 = __importDefault(require("../../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../../middlewares/validateRequest"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const employeePermit_service_1 = require("./employeePermit.service");
const employeePermit_validation_1 = require("./employeePermit.validation");
const checkId = (_req, _res, next, id) => {
    if (!(0, mongoose_1.isValidObjectId)(id))
        return next(new AppError_1.default(http_status_1.default.NOT_FOUND, "Employee permit not found"));
    next();
};
const publicRouter = express_1.default.Router();
publicRouter.get("/:userId", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const record = yield employeePermit_service_1.EmployeePermitService.getPublic(req.params.userId);
    res.set("Cache-Control", "no-store");
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: (0, employeePermit_service_1.toEmployeePermit)(record) });
})));
const adminRouter = express_1.default.Router();
adminRouter.use((0, auth_1.default)(), (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
adminRouter.param("id", checkId);
adminRouter.get("/", (0, validateRequest_1.default)(employeePermit_validation_1.EmployeePermitValidation.adminList), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield employeePermit_service_1.EmployeePermitService.list(req.query);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data });
})));
adminRouter.post("/", (0, validateRequest_1.default)(employeePermit_validation_1.EmployeePermitValidation.create), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield employeePermit_service_1.EmployeePermitService.create(req.body);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.CREATED, success: true, message: "Employee permit created", data });
})));
adminRouter.get("/:id/qr", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const record = yield employeePermit_service_1.EmployeePermitService.getAdmin(req.params.id);
    const png = yield qrcode_1.default.toBuffer((0, employeePermit_service_1.employeePermitUrl)(record.userId), { type: "png", errorCorrectionLevel: "M", width: 768, margin: 3 });
    res.type("png");
    if (req.query.download === "1")
        res.attachment(`employee-permit-${record.userId}-qr.png`);
    res.send(png);
})));
adminRouter.get("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield employeePermit_service_1.EmployeePermitService.getAdmin(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, data: (0, employeePermit_service_1.toEmployeePermit)(data) });
})));
adminRouter.patch("/:id", (0, validateRequest_1.default)(employeePermit_validation_1.EmployeePermitValidation.update), (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield employeePermit_service_1.EmployeePermitService.update(req.params.id, req.body);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, message: "Changes saved", data });
})));
adminRouter.delete("/:id", (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield employeePermit_service_1.EmployeePermitService.remove(req.params.id);
    (0, sendResponse_1.default)(res, { statusCode: http_status_1.default.OK, success: true, message: "Employee permit deleted", data });
})));
exports.PublicEmployeePermitRoutes = publicRouter;
exports.AdminEmployeePermitRoutes = adminRouter;
