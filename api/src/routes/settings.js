const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', authenticate, adminOnly, settingsController.getSettings);
router.post('/', authenticate, adminOnly, settingsController.updateSettings);

module.exports = router;
