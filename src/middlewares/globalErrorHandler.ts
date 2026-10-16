/**
 * Turns every thrown error into one consistent JSON response:
 *   { success: false, message, errorSources }
 *
 * - ZodError (validateRequest)    -> 400, first problem as the message
 * - Mongoose ValidationError      -> 400
 * - AppError (thrown on purpose)  -> its own status code and message
 * - Duplicate key (code 11000)    -> 409
 * - Bad / oversized JSON body     -> 400 / 413
 * - Anything else                 -> 500 "Something went wrong!" (details only logged)
 *
 * Stack traces are included only when NODE_ENV=development.
 */
import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import config from "../app/config";
import AppError from "../app/error/AppError";
import { handleDupliacteError } from "../app/error/handleDuplicateError";
import handleValidationError from "../app/error/handleValidationError";
import handleZodError from "../app/error/handleZodError";
import { TErrorSources } from "../app/interface/error";

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  //setting default values
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorSources: TErrorSources = [
    {
      path: "",
      message: "Something went wrong",
    },
  ];
  // handle multiple type error
  if (err instanceof ZodError) {
    //Zod Error
    const simplifiedError = handleZodError(err);
    // Show the first problem in plain words (e.g. "Name is required")
    message = simplifiedError?.errorSources[0]?.message || simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
    statusCode = 400;
  } else if (err?.name === "ValidationError") {
    //Validation Error
    const simplifiedError = handleValidationError(err);
    statusCode = 400;
    message = simplifiedError?.message;
    errorSources = simplifiedError?.errorSources;
  } else if (err instanceof AppError) {
    //App Error
    message = err.message;
    statusCode = err.statusCode;
    errorSources = [
      {
        path: "Custom Error",
        message: err.message,
      },
    ];
  } else if (err?.code === 11000) {
    //check duplicate
    statusCode = 409;
    message = handleDupliacteError(err);
  } else if (err?.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid request body";
  } else if (err?.type === "entity.too.large") {
    statusCode = 413;
    message = "Request is too large";
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  //ultimate return – internals are only included during development
  const isDev = config.node_env === "development";
  return res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    ...(isDev && { stack: err?.stack }),
  });
};

export default globalErrorHandler;
