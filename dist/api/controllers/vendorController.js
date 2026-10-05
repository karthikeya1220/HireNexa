"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getVendorById = exports.getAllVendors = void 0;
const Vendor_1 = __importDefault(require("../models/Vendor"));
const auth_helpers_1 = require("../utils/auth-helpers");
const errors_1 = require("../utils/errors");
// Vendors are readable by any authenticated user (shared list), but only the
// creator or an admin may modify/delete them.
const assertCanModify = (req, vendor, res) => {
    var _a, _b, _c;
    if (!(0, auth_helpers_1.canModifyResource)((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid, (_b = vendor === null || vendor === void 0 ? void 0 : vendor.metadata) === null || _b === void 0 ? void 0 : _b.created_by_id, (_c = req.user) === null || _c === void 0 ? void 0 : _c.role)) {
        res.status(403).json({ error: 'Not authorized to modify this vendor' });
        return false;
    }
    return true;
};
// Get all vendors
const getAllVendors = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Get query parameters — must be a plain string, otherwise query-string
        // operators like ?status[$ne]=x would be executed by MongoDB.
        const rawStatus = req.query.status;
        const status = typeof rawStatus === 'string' ? rawStatus : undefined;
        // Build query object
        const query = status && status !== 'all' ? { status } : {};
        // Find all vendors
        const vendors = await Vendor_1.default.find(query).sort({ created_at: -1 });
        res.status(200).json(vendors);
    }
    catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
};
exports.getAllVendors = getAllVendors;
// Get vendor by ID
const getVendorById = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const vendor = await Vendor_1.default.findById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        res.status(200).json(vendor);
    }
    catch (error) {
        console.error('Error fetching vendor:', error);
        res.status(500).json({ error: 'Failed to fetch vendor' });
    }
};
exports.getVendorById = getVendorById;
// Create a new vendor
const createVendor = async (req, res) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Add metadata to vendor data — server owns identity fields
        const { _id, metadata, created_at, updated_at, ...bodyFields } = req.body || {};
        const vendorData = {
            ...bodyFields,
            metadata: {
                created_by: userEmail,
                created_by_id: userId,
                last_modified_by: userEmail,
            }
        };
        const vendor = new Vendor_1.default(vendorData);
        await vendor.save();
        res.status(201).json(vendor);
    }
    catch (error) {
        console.error('Error creating vendor:', error);
        if ((0, errors_1.errCode)(error) === 11000) {
            return res.status(409).json({ error: 'Vendor already exists' });
        }
        res.status(500).json({ error: 'Failed to create vendor' });
    }
};
exports.createVendor = createVendor;
// Update an existing vendor
const updateVendor = async (req, res) => {
    var _a, _b;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const vendor = await Vendor_1.default.findById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        if (!assertCanModify(req, vendor, res))
            return;
        // Update vendor data with last modifier info — strip ownership/identity
        // fields the client must not control
        const { _id, metadata, created_at, updated_at, ...updateFields } = req.body || {};
        const updatedVendorData = {
            ...updateFields,
            'metadata.last_modified_by': userEmail,
        };
        const updatedVendor = await Vendor_1.default.findByIdAndUpdate(id, updatedVendorData, { new: true, runValidators: true });
        res.status(200).json(updatedVendor);
    }
    catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ error: 'Failed to update vendor' });
    }
};
exports.updateVendor = updateVendor;
// Delete a vendor
const deleteVendor = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const vendor = await Vendor_1.default.findById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        if (!assertCanModify(req, vendor, res))
            return;
        // Delete vendor
        await Vendor_1.default.findByIdAndDelete(id);
        res.status(200).json({ message: 'Vendor deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ error: 'Failed to delete vendor' });
    }
};
exports.deleteVendor = deleteVendor;
