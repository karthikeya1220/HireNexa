"use strict";
// jobs table: row shape (snake/flat columns) and the public API shape the
// frontend has always consumed (`_id`, flat fields, metadata jsonb).
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJob = void 0;
const toJob = (row) => {
    const { id, ...rest } = row;
    return { ...rest, _id: id };
};
exports.toJob = toJob;
