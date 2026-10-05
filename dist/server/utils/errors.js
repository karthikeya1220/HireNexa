"use strict";
// Narrow helpers for inspecting unknown caught errors (AWS S3 error names)
// without resorting to `any`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.errHttpStatus = exports.errName = void 0;
const isRecord = (value) => typeof value === 'object' && value !== null;
const errName = (error) => {
    if (error instanceof Error)
        return error.name;
    if (isRecord(error) && typeof error.name === 'string')
        return error.name;
    return undefined;
};
exports.errName = errName;
const errHttpStatus = (error) => {
    if (!isRecord(error))
        return undefined;
    const meta = error.$metadata;
    if (isRecord(meta) && typeof meta.httpStatusCode === 'number') {
        return meta.httpStatusCode;
    }
    return undefined;
};
exports.errHttpStatus = errHttpStatus;
