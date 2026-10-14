const express = require('express');
const authenticate = require('../middlewares/authenticate');
const saleController = require('../controllers/saleController');

const router = express.Router();

router.get('/sales/open/list', authenticate, saleController.listOpenSales);
router.get('/sales/pending/list', authenticate, saleController.listPendingSales);
router.get('/sales/history/finalized', authenticate, saleController.listFinalizedSalesHistory);

router.post('/sales', authenticate, saleController.createSale);
router.get('/sales/:id', authenticate, saleController.getSaleById);
router.post('/sales/:id/items', authenticate, saleController.addSaleItem);
router.delete('/sales/:id/items/:itemId', authenticate, saleController.removeSaleItem);
router.post('/sales/:id/finalize', authenticate, saleController.finalizeSale);
router.post('/sales/:id/cancel', authenticate, saleController.cancelSale);
router.post('/sales/:id/settle', authenticate, saleController.settlePendingSale);

module.exports = router;
