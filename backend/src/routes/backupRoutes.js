const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const backupController = require('../controllers/backupController');
const { ROLES } = require('../shared/roles');

const router = express.Router();
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get('/backup/status', authenticate, adminOnly, backupController.backupStatus);
router.post('/backup/manual', authenticate, adminOnly, backupController.manualBackup);

module.exports = router;
