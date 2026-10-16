/**
 * An error with an HTTP status code. Throw it anywhere in a handler/service,
 * e.g. throw new AppError(404, "Akama record not found"), and globalErrorHandler
 * sends that status and message to the client.
 */
class AppError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string, stack = "") {
    super(message);
    this.statusCode = statusCode;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
