const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const productController = require('../controllers/productController');
const { ROLES } = require('../shared/roles');

const router = express.Router();
const adminOnly = authorizeRoles(ROLES.ADMIN);

// Cadastro de produtos: só admin altera. Consulta e movimentação de
// estoque ficam liberadas para o funcionário (o custo é ocultado no service).
router.get('/products', authenticate, productController.listProducts);
router.get('/products/:id', authenticate, productController.getProductById);
router.post('/products', authenticate, adminOnly, productController.createProduct);
router.put('/products/:id', authenticate, adminOnly, productController.updateProduct);
router.delete('/products/:id', authenticate, adminOnly, productController.deleteProduct);

router.post('/products/:id/stock/entry', authenticate, productController.registerStockEntry);
router.post('/products/:id/stock/adjustment', authenticate, productController.adjustStock);

router.get('/stock/alerts/minimum', authenticate, productController.lowStockAlert);
router.get('/stock/alerts/expiration', authenticate, productController.expirationAlert);
router.get('/stock/replenishment', authenticate, productController.replenishmentList);
router.get('/stock/replenishment/pdf', authenticate, productController.exportReplenishmentPdf);
router.post('/stock/replenishment/:id/dismiss', authenticate, productController.dismissReplenishmentItem);
router.delete('/stock/replenishment/:id/dismiss', authenticate, productController.restoreReplenishmentItem);

module.exports = router;
