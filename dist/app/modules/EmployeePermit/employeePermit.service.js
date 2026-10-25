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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeePermitService = exports.toEmployeePermit = exports.employeePermitUrl = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../error/AppError"));
const employeePermit_model_1 = require("./employeePermit.model");
const NOT_FOUND = "Employee permit not found";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const employeePermitUrl = (userId) => `${config_1.default.employee_permit_public_url}/id/${encodeURIComponent(userId)}`;
exports.employeePermitUrl = employeePermitUrl;
const toEmployeePermit = (doc) => { const _a = doc, { _id } = _a, record = __rest(_a, ["_id"]); return Object.assign(Object.assign({}, record), { id: _id.toString(), publicUrl: (0, exports.employeePermitUrl)(doc.userId) }); };
exports.toEmployeePermit = toEmployeePermit;
const list = ({ search, page, limit, sort }) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = {};
    if (search === null || search === void 0 ? void 0 : search.trim()) {
        const regex = { $regex: escapeRegex(search.trim()), $options: "i" };
        filter.$or = [{ userId: regex }, { employeeName: regex }, { permitNumber: regex }, { establishmentName: regex }];
    }
    const direction = sort === "oldest" ? 1 : -1;
    const [docs, total] = yield Promise.all([employeePermit_model_1.EmployeePermitModel.find(filter).sort({ createdAt: direction, _id: direction }).skip((page - 1) * limit).limit(limit).lean(), employeePermit_model_1.EmployeePermitModel.countDocuments(filter)]);
    return { items: docs.map(exports.toEmployeePermit), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
});
const getPublic = (userId) => __awaiter(void 0, void 0, void 0, function* () { const doc = yield employeePermit_model_1.EmployeePermitModel.findOne({ userId }).lean(); if (!doc)
    throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND); return doc; });
const getAdmin = (id) => __awaiter(void 0, void 0, void 0, function* () { const doc = yield employeePermit_model_1.EmployeePermitModel.findById(id).lean(); if (!doc)
    throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND); return doc; });
const create = (input) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield employeePermit_model_1.EmployeePermitModel.exists({ userId: input.userId }))
        throw new AppError_1.default(http_status_1.default.CONFLICT, "A permit with this ID/Residence number already exists.");
    return (0, exports.toEmployeePermit)((yield employeePermit_model_1.EmployeePermitModel.create(input)).toObject());
});
const update = (id, input) => __awaiter(void 0, void 0, void 0, function* () {
    if (input.userId && (yield employeePermit_model_1.EmployeePermitModel.exists({ userId: input.userId, _id: { $ne: id } })))
        throw new AppError_1.default(http_status_1.default.CONFLICT, "A permit with this ID/Residence number already exists.");
    const doc = yield employeePermit_model_1.EmployeePermitModel.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean();
    if (!doc)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND);
    return (0, exports.toEmployeePermit)(doc);
});
const remove = (id) => __awaiter(void 0, void 0, void 0, function* () { const doc = yield employeePermit_model_1.EmployeePermitModel.findByIdAndDelete(id).lean(); if (!doc)
    throw new AppError_1.default(http_status_1.default.NOT_FOUND, NOT_FOUND); return { id }; });
exports.EmployeePermitService = { list, getPublic, getAdmin, create, update, remove };
