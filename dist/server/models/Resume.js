"use strict";
// resumes table row/API shapes. Note the API historically speaks
// `fileHash` (camel) while every other field is snake_case — keep that.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toResume = void 0;
const toResume = (row) => {
    var _a;
    return ({
        _id: row.id,
        user_id: row.user_id,
        filename: row.filename,
        filelink: row.filelink,
        fileHash: row.file_hash,
        analysis: (_a = row.analysis) !== null && _a !== void 0 ? _a : {},
        vendor_id: row.vendor_id,
        vendor_name: row.vendor_name,
        uploaded_at: row.uploaded_at,
        updated_at: row.updated_at,
    });
};
exports.toResume = toResume;
