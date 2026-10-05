"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getVendorById = exports.getAllVendors = void 0;
const db_1 = require("../db");
const Vendor_1 = require("../models/Vendor");
const auth_helpers_1 = require("../utils/auth-helpers");
// Columns the client may write on vendors (everything else is server-owned).
const VENDOR_WRITABLE_COLUMNS = [
    'name', 'address', 'contact_person', 'country', 'email', 'phone', 'state', 'status',
];
const pickVendorFields = (body) => {
    const out = {};
    for (const key of VENDOR_WRITABLE_COLUMNS) {
        if (body && key in body)
            out[key] = body[key];
    }
    return out;
};
const findVendorById = async (id) => {
    if (!(0, db_1.isUuid)(id))
        return null;
    const { data, error } = await db_1.supabaseAdmin.from('vendors').select('*').eq('id', id).maybeSingle();
    if (error)
        throw error;
    return data ? (0, Vendor_1.toVendor)(data) : null;
};
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
        // Get query parameters — must be a plain string.
        const rawStatus = req.query.status;
        const status = typeof rawStatus === 'string' ? rawStatus : undefined;
        let query = db_1.supabaseAdmin.from('vendors').select('*');
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        const { data: vendors, error } = await query.order('created_at', { ascending: false });
        if (error)
            throw error;
        res.status(200).json((vendors !== null && vendors !== void 0 ? vendors : []).map((row) => (0, Vendor_1.toVendor)(row)));
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
        const vendor = await findVendorById(id);
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
        const vendorData = {
            ...pickVendorFields(req.body),
            metadata: {
                created_by: userEmail,
                created_by_id: userId,
                last_modified_by: userEmail,
            },
        };
        const { data: vendor, error } = await db_1.supabaseAdmin
            .from('vendors')
            .insert(vendorData)
            .select('*')
            .single();
        if (error)
            throw error;
        res.status(201).json((0, Vendor_1.toVendor)(vendor));
    }
    catch (error) {
        console.error('Error creating vendor:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 409) {
            return res.status(409).json({ error: 'Vendor already exists' });
        }
        res.status(500).json({ error: 'Failed to create vendor' });
    }
};
exports.createVendor = createVendor;
// Update an existing vendor
const updateVendor = async (req, res) => {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const vendor = await findVendorById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        if (!assertCanModify(req, vendor, res))
            return;
        // Update vendor data with last modifier info — ownership metadata is
        // merged (never replaced) like the old dotted-path update
        const updatedVendorData = {
            ...pickVendorFields(req.body),
            metadata: {
                ...((_c = vendor.metadata) !== null && _c !== void 0 ? _c : {}),
                last_modified_by: userEmail,
            },
        };
        const { data: updatedVendor, error } = await db_1.supabaseAdmin
            .from('vendors')
            .update(updatedVendorData)
            .eq('id', id)
            .select('*')
            .maybeSingle();
        if (error)
            throw error;
        if (!updatedVendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        res.status(200).json((0, Vendor_1.toVendor)(updatedVendor));
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
        const vendor = await findVendorById(id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        if (!assertCanModify(req, vendor, res))
            return;
        // Delete vendor
        const { error } = await db_1.supabaseAdmin.from('vendors').delete().eq('id', id);
        if (error)
            throw error;
        res.status(200).json({ message: 'Vendor deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ error: 'Failed to delete vendor' });
    }
};
exports.deleteVendor = deleteVendor;
