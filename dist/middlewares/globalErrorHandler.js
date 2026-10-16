"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const config_1 = __importDefault(require("../app/config"));
const AppError_1 = __importDefault(require("../app/error/AppError"));
const handleDuplicateError_1 = require("../app/error/handleDuplicateError");
const handleValidationError_1 = __importDefault(require("../app/error/handleValidationError"));
const handleZodError_1 = __importDefault(require("../app/error/handleZodError"));
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
    var _a;
    //setting default values
    let statusCode = 500;
    let message = "Something went wrong!";
    let errorSources = [
        {
            path: "",
            message: "Something went wrong",
        },
    ];
    // handle multiple type error
    if (err instanceof zod_1.ZodError) {
        //Zod Error
        const simplifiedError = (0, handleZodError_1.default)(err);
        // Show the first problem in plain words (e.g. "Name is required")
        message = ((_a = simplifiedError === null || simplifiedError === void 0 ? void 0 : simplifiedError.errorSources[0]) === null || _a === void 0 ? void 0 : _a.message) || (simplifiedError === null || simplifiedError === void 0 ? void 0 : simplifiedError.message);
        errorSources = simplifiedError === null || simplifiedError === void 0 ? void 0 : simplifiedError.errorSources;
        statusCode = 400;
    }
    else if ((err === null || err === void 0 ? void 0 : err.name) === "ValidationError") {
        //Validation Error
        const simplifiedError = (0, handleValidationError_1.default)(err);
        statusCode = 400;
        message = simplifiedError === null || simplifiedError === void 0 ? void 0 : simplifiedError.message;
        errorSources = simplifiedError === null || simplifiedError === void 0 ? void 0 : simplifiedError.errorSources;
    }
    else if (err instanceof AppError_1.default) {
        //App Error
        message = err.message;
        statusCode = err.statusCode;
        errorSources = [
            {
                path: "Custom Error",
                message: err.message,
            },
        ];
    }
    else if ((err === null || err === void 0 ? void 0 : err.code) === 11000) {
        //check duplicate
        statusCode = 409;
        message = (0, handleDuplicateError_1.handleDupliacteError)(err);
    }
    else if ((err === null || err === void 0 ? void 0 : err.type) === "entity.parse.failed") {
        statusCode = 400;
        message = "Invalid request body";
    }
    else if ((err === null || err === void 0 ? void 0 : err.type) === "entity.too.large") {
        statusCode = 413;
        message = "Request is too large";
    }
    if (statusCode >= 500) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
    //ultimate return – internals are only included during development
    const isDev = config_1.default.node_env === "development";
    return res.status(statusCode).json(Object.assign({ success: false, message,
        errorSources }, (isDev && { stack: err === null || err === void 0 ? void 0 : err.stack })));
};
exports.default = globalErrorHandler;
