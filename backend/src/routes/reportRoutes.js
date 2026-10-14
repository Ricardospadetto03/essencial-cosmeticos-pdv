const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const reportController = require('../controllers/reportController');
const { ROLES } = require('../shared/roles');

const router = express.Router();
const adminOnly = authorizeRoles(ROLES.ADMIN);

// Caixa do dia: funcionário consulta e fecha; só admin reabre.
router.get('/cash/summary/daily', authenticate, reportController.dailyCashSummary);
router.get('/cash/closure', authenticate, reportController.dailyCashClosureStatus);
router.post('/cash/close', authenticate, reportController.closeDailyCash);
router.post('/cash/reopen', authenticate, adminOnly, reportController.reopenDailyCash);

// Relatórios mensais mostram lucro, então são só do admin.
router.get('/dashboard/monthly', authenticate, adminOnly, reportController.monthlyDashboard);
router.get('/reports/monthly/pdf', authenticate, adminOnly, reportController.monthlyReportPdf);

module.exports = router;
