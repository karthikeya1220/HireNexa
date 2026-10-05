import express from 'express';
import { 
  getAllVendors, 
  getVendorById, 
  createVendor, 
  updateVendor, 
  deleteVendor 
} from '../controllers/vendorController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Vendor routes - GET all vendors
router.get('/', getAllVendors);

// GET a specific vendor
router.get('/:id', getVendorById);

// Create a new vendor
router.post('/', createVendor);

// Update an existing vendor
router.put('/:id', updateVendor);

// Delete a vendor
router.delete('/:id', deleteVendor);

export default router; 