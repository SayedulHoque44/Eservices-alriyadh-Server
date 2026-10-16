/**
 * Validates a request with a Zod schema before it reaches the route handler.
 *
 * Usage: router.post("/", validateRequest(SomeValidation.create), handler)
 * The schema may describe `body`, `query` and/or `params`. Invalid input throws
 * a ZodError, which globalErrorHandler turns into a 400 response with a
 * readable message.
 */
import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";
import catchAsync from "../app/utils/catchAsync";

const validateRequest = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Keep the cleaned values (trimmed strings, coerced numbers, defaults, ...)
    // so handlers work with validated data rather than the raw input.
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  });
};

export default validateRequest;
