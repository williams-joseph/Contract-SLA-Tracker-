const express = require('express');
const router = express.Router();
const {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
} = require('../controllers/vendorController');
const { authenticate, adminOnly } = require('../middleware/auth');

// Public
router.get('/', getAllVendors);
router.get('/:id', getVendorById);
router.post('/', authenticate, createVendor);
router.put('/:id', authenticate, updateVendor);
router.delete('/:id', authenticate, adminOnly, deleteVendor);

module.exports = router;
