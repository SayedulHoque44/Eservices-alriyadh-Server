/**
 * Wraps an async route handler so a thrown error / rejected promise is passed
 * to next() and ends up in globalErrorHandler instead of crashing the request.
 */
import { NextFunction, Request, RequestHandler, Response } from "express";

const catchAsync = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(err => next(err));
  };
};

export default catchAsync;
