const reportService = require('../services/reportService');

async function dailyCashSummary(req, res, next) {
  try {
    const result = await reportService.getDailyCashSummary(req.user.role, req.query.date);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function dailyCashClosureStatus(req, res, next) {
  try {
    const result = await reportService.getDailyCashClosureStatus(req.query.date);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function closeDailyCash(req, res, next) {
  try {
    const result = await reportService.closeDailyCash(req.user, req.body?.date);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function reopenDailyCash(req, res, next) {
  try {
    const result = await reportService.reopenDailyCash(req.body?.date);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function monthlyDashboard(req, res, next) {
  try {
    const result = await reportService.getMonthlyDashboard(req.query.year, req.query.month);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function monthlyReportPdf(req, res, next) {
  try {
    const { buffer, fileName } = await reportService.generateMonthlyReportPdf(
      req.query.year,
      req.query.month
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dailyCashSummary,
  dailyCashClosureStatus,
  closeDailyCash,
  reopenDailyCash,
  monthlyDashboard,
  monthlyReportPdf,
};
