"use strict";
// users table row shape (Supabase Postgres). The API has always spoken
// uid/email/name/role — that contract is unchanged from the Mongo era.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicUser = void 0;
const toPublicUser = (row) => {
    var _a;
    return ({
        uid: row.uid,
        email: row.email,
        name: (_a = row.name) !== null && _a !== void 0 ? _a : undefined,
        role: row.role,
        created_at: row.created_at,
    });
};
exports.toPublicUser = toPublicUser;
