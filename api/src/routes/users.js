const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
} = require('../controllers/userController');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, adminOnly, getAllUsers);
router.get('/:id', authenticate, adminOnly, getUserById);
router.post('/', authenticate, adminOnly, createUser);
router.put('/:id', authenticate, adminOnly, updateUser);
router.delete('/:id', authenticate, adminOnly, deactivateUser);

module.exports = router;
