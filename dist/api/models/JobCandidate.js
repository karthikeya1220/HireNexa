"use strict";
// job_candidates table: interfaces kept identical to the Mongo era (the
// frontend consumes matchAnalysis/tracking camelCase), plus row <-> API mappers.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCandidate = void 0;
const toCandidate = (row) => {
    var _a;
    return ({
        _id: row.id,
        jobId: row.job_id,
        filename: row.filename,
        name: row.name,
        email: row.email,
        matchAnalysis: row.match_analysis,
        analysis: row.analysis,
        tracking: (_a = row.tracking) !== null && _a !== void 0 ? _a : undefined,
        userId: row.user_id,
        userEmail: row.user_email,
        created_at: row.created_at,
        updated_at: row.updated_at,
    });
};
exports.toCandidate = toCandidate;
