const express = require('express');
const router = express.Router();
const {
  getAllContracts,
  getExpiringContracts,
  getContractStats,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  renewContract,
} = require('../controllers/contractController');
const { authenticate, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public (main-web can call these)
router.get('/', getAllContracts);
router.get('/expiring', getExpiringContracts);
router.get('/stats', getContractStats);
router.get('/:id', getContractById);

// Admin/Officer actions
router.post('/', authenticate, upload.single('pdf'), createContract);
router.post('/:id/renew', authenticate, renewContract);
router.put('/:id', authenticate, upload.single('pdf'), updateContract);
router.delete('/:id', authenticate, adminOnly, deleteContract); // only admin can delete

module.exports = router;
