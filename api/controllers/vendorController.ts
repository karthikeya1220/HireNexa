import { Request, Response } from 'express';
import Vendor from '../models/Vendor';
import { canModifyResource } from '../utils/auth-helpers';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role?: string;
    [key: string]: any;
  };
}

// Vendors are readable by any authenticated user (shared list), but only the
// creator or an admin may modify/delete them.
const assertCanModify = (req: AuthRequest, vendor: any, res: Response): boolean => {
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

    // Get query parameters
    const status = req.query.status as string;
    
    // Build query object
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Find all vendors
    const vendors = await Vendor.find(query).sort({ created_at: -1 });
    
    res.status(200).json(vendors);
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
    
    const vendor = await Vendor.findById(id);
    
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
    const { _id, metadata, created_at, updated_at, ...bodyFields } = req.body || {};
    const vendorData = {
      ...bodyFields,
      metadata: {
        created_by: userEmail,
        created_by_id: userId,
        last_modified_by: userEmail,
      }
    };
    
    const vendor = new Vendor(vendorData);
    await vendor.save();
    
    res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
    if ((error as any)?.code === 11000) {
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
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    if (!assertCanModify(req, vendor, res)) return;
    
    // Update vendor data with last modifier info — strip ownership/identity
    // fields the client must not control
    const { _id, metadata, created_at, updated_at, ...updateFields } = req.body || {};
    const updatedVendorData = {
      ...updateFields,
      'metadata.last_modified_by': userEmail,
    };
    
    const updatedVendor = await Vendor.findByIdAndUpdate(id, updatedVendorData, { new: true, runValidators: true });
    
    res.status(200).json(updatedVendor);
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
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    if (!assertCanModify(req, vendor, res)) return;
    
    // Delete vendor
    await Vendor.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
}; 