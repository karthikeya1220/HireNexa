"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vendorController_1 = require("../controllers/vendorController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Apply authentication middleware to all routes
router.use(authMiddleware_1.authenticate);
// Vendor routes - GET all vendors
router.get('/', vendorController_1.getAllVendors);
// GET a specific vendor
router.get('/:id', vendorController_1.getVendorById);
// Create a new vendor
router.post('/', vendorController_1.createVendor);
// Update an existing vendor
router.put('/:id', vendorController_1.updateVendor);
// Delete a vendor
router.delete('/:id', vendorController_1.deleteVendor);
exports.default = router;
