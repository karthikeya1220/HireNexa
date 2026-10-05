"use strict";
// vendors table row/API shapes (flat fields + metadata jsonb, as before).
Object.defineProperty(exports, "__esModule", { value: true });
exports.toVendor = void 0;
const toVendor = (row) => {
    const { id, ...rest } = row;
    return { ...rest, _id: id };
};
exports.toVendor = toVendor;
