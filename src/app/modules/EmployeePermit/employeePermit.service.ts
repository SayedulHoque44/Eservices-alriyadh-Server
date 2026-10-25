import httpStatus from "http-status";
import { FilterQuery } from "mongoose";
import config from "../../config";
import AppError from "../../error/AppError";
import { IEmployeePermit, TEmployeePermitQuery } from "./employeePermit.interface";
import { EmployeePermitModel } from "./employeePermit.model";
const NOT_FOUND = "Employee permit not found";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const employeePermitUrl = (userId: string) => `${config.employee_permit_public_url}/id/${encodeURIComponent(userId)}`;
export const toEmployeePermit = (doc: IEmployeePermit) => { const { _id, ...record } = doc as IEmployeePermit & { _id: IEmployeePermit["_id"] }; return { ...record, id: _id.toString(), publicUrl: employeePermitUrl(doc.userId) }; };
const list = async ({ search, page, limit, sort }: TEmployeePermitQuery) => {
  const filter: FilterQuery<IEmployeePermit> = {};
  if (search?.trim()) { const regex = { $regex: escapeRegex(search.trim()), $options: "i" }; filter.$or = [{ userId: regex }, { employeeName: regex }, { permitNumber: regex }, { establishmentName: regex }]; }
  const direction = sort === "oldest" ? 1 : -1;
  const [docs, total] = await Promise.all([EmployeePermitModel.find(filter).sort({ createdAt: direction, _id: direction }).skip((page - 1) * limit).limit(limit).lean<IEmployeePermit[]>(), EmployeePermitModel.countDocuments(filter)]);
  return { items: docs.map(toEmployeePermit), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
};
const getPublic = async (userId: string) => { const doc = await EmployeePermitModel.findOne({ userId }).lean<IEmployeePermit>(); if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND); return doc; };
const getAdmin = async (id: string) => { const doc = await EmployeePermitModel.findById(id).lean<IEmployeePermit>(); if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND); return doc; };
const create = async (input: Partial<IEmployeePermit>) => {
  if (await EmployeePermitModel.exists({ userId: input.userId })) throw new AppError(httpStatus.CONFLICT, "A permit with this ID/Residence number already exists.");
  return toEmployeePermit((await EmployeePermitModel.create(input)).toObject());
};
const update = async (id: string, input: Partial<IEmployeePermit>) => {
  if (input.userId && await EmployeePermitModel.exists({ userId: input.userId, _id: { $ne: id } })) throw new AppError(httpStatus.CONFLICT, "A permit with this ID/Residence number already exists.");
  const doc = await EmployeePermitModel.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean<IEmployeePermit>();
  if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND); return toEmployeePermit(doc);
};
const remove = async (id: string) => { const doc = await EmployeePermitModel.findByIdAndDelete(id).lean<IEmployeePermit>(); if (!doc) throw new AppError(httpStatus.NOT_FOUND, NOT_FOUND); return { id }; };
export const EmployeePermitService = { list, getPublic, getAdmin, create, update, remove };

