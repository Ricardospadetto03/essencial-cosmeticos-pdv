const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const userController = require('../controllers/userController');
const { ROLES } = require('../shared/roles');

const router = express.Router();
const adminOnly = authorizeRoles(ROLES.ADMIN);

// GET e PUT são liberados para o funcionário, mas o controller limita
// ao próprio cadastro.
router.get('/users', authenticate, userController.listUsers);
router.post('/users', authenticate, adminOnly, userController.createUser);
router.put('/users/:id', authenticate, userController.updateUser);
router.delete('/users/:id', authenticate, adminOnly, userController.deleteUser);

module.exports = router;
