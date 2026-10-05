import { Request, Response } from 'express';
import { supabaseAdmin, isUuid, httpStatusForDbError } from '../db';
import { type IVendor, type VendorRow, toVendor } from '../models/Vendor';
import { canModifyResource } from '../utils/auth-helpers';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

// Columns the client may write on vendors (everything else is server-owned).
const VENDOR_WRITABLE_COLUMNS = [
  'name', 'address', 'contact_person', 'country', 'email', 'phone', 'state', 'status',
] as const;

const pickVendorFields = (body: Record<string, unknown> | undefined): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of VENDOR_WRITABLE_COLUMNS) {
    if (body && key in body) out[key] = body[key];
  }
  return out;
};

const findVendorById = async (id: string): Promise<IVendor | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await supabaseAdmin.from('vendors').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toVendor(data as VendorRow) : null;
};

// Vendors are readable by any authenticated user (shared list), but only the
// creator or an admin may modify/delete them.
const assertCanModify = (
  req: AuthRequest,
  vendor: Pick<IVendor, 'metadata'> | null | undefined,
  res: Response
): boolean => {
  if (!canModifyResource(req.user?.uid, vendor?.metadata?.created_by_id, req.user?.role)) {
    res.status(403).json({ error: 'Not authorized to modify this vendor' });
    return false;
  }
  return true;
};

// Get all vendors
export const getAllVendors = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get query parameters — must be a plain string.
    const rawStatus = req.query.status;
    const status = typeof rawStatus === 'string' ? rawStatus : undefined;

    let query = supabaseAdmin.from('vendors').select('*');
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: vendors, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json((vendors ?? []).map((row) => toVendor(row as VendorRow)));
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

// Get vendor by ID
export const getVendorById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const vendor = await findVendorById(id);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.status(200).json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
};

// Create a new vendor
export const createVendor = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const userEmail = req.user?.email;

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

    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .insert(vendorData)
      .select('*')
      .single();
    if (error) throw error;

    res.status(201).json(toVendor(vendor as VendorRow));
  } catch (error) {
    console.error('Error creating vendor:', error);
    if (httpStatusForDbError(error) === 409) {
      return res.status(409).json({ error: 'Vendor already exists' });
    }
    res.status(500).json({ error: 'Failed to create vendor' });
  }
};

// Update an existing vendor
export const updateVendor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const vendor = await findVendorById(id);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (!assertCanModify(req, vendor, res)) return;

    // Update vendor data with last modifier info — ownership metadata is
    // merged (never replaced) like the old dotted-path update
    const updatedVendorData = {
      ...pickVendorFields(req.body),
      metadata: {
        ...(vendor.metadata ?? {}),
        last_modified_by: userEmail,
      },
    };

    const { data: updatedVendor, error } = await supabaseAdmin
      .from('vendors')
      .update(updatedVendorData)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!updatedVendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.status(200).json(toVendor(updatedVendor as VendorRow));
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
};

// Delete a vendor
export const deleteVendor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const vendor = await findVendorById(id);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    if (!assertCanModify(req, vendor, res)) return;

    // Delete vendor
    const { error } = await supabaseAdmin.from('vendors').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
};
