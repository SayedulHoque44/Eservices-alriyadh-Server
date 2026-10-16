"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDupliacteError = void 0;
const handleDupliacteError = (err) => {
    const match = err.message.match(/"([^"]*)"/);
    //
    const extractMessage = match && match[1];
    return `${extractMessage} is already Taken!`;
};
exports.handleDupliacteError = handleDupliacteError;
