const PDFDocument = require('pdfkit');
const AppError = require('../shared/AppError');
const { ROLES } = require('../shared/roles');
const { toLocalDate } = require('../shared/dates');
const reportRepository = require('../repositories/reportRepository');

/**
 * Resolve e valida data diária.
 * @param {string|undefined} rawDate
 * @returns {string}
 */
function resolveDailyDate(rawDate) {
  if (!rawDate) {
    return toLocalDate();
  }

  const date = String(rawDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Parâmetro date inválido. Use YYYY-MM-DD.', 400, 'INVALID_DATE');
  }
  return date;
}

/**
 * Converte registro bruto de fechamento para estrutura da API.
 * @param {Object|undefined} closure
 * @returns {Object|null}
 */
function normalizeCashClosure(closure) {
  if (!closure) {
    return null;
  }

  let byPayment = [];
  try {
    byPayment = JSON.parse(closure.by_payment_json || '[]');
  } catch (error) {
    byPayment = [];
  }

  return {
    id: closure.id,
    date: closure.closure_date,
    total_sold: Number(closure.total_sold || 0),
    sales_count: Number(closure.sales_count || 0),
    by_payment: Array.isArray(byPayment) ? byPayment : [],
    closed_by_user_id: closure.closed_by_user_id,
    closed_by_name: closure.closed_by_name,
    closed_at: closure.closed_at,
  };
}

/**
 * Resolve faixa mensal de datas a partir de ano/mês.
 * @param {number|string|undefined} rawYear
 * @param {number|string|undefined} rawMonth
 * @returns {{year:number, month:number, startDate:string, endDate:string}}
 */
function resolveMonthRange(rawYear, rawMonth) {
  const now = new Date();
  const year = rawYear === undefined ? now.getFullYear() : Number(rawYear);
  const month = rawMonth === undefined ? now.getMonth() + 1 : Number(rawMonth);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError('Parâmetro year inválido.', 400, 'INVALID_YEAR');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError('Parâmetro month inválido.', 400, 'INVALID_MONTH');
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  return {
    year,
    month,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/**
 * Resumo diário de caixa.
 * @param {string} role
 * @param {string|undefined} date
 * @returns {Promise<Object>}
 */
async function getDailyCashSummary(role, date) {
  const reportDate = resolveDailyDate(date);
  const canViewProfit = role === ROLES.ADMIN;

  const [summary, byPayment, soldProducts] = await Promise.all([
    reportRepository.getDailySummary(reportDate),
    reportRepository.getDailySummaryByPayment(reportDate),
    reportRepository.getDailySoldProducts(reportDate),
  ]);

  return {
    date: reportDate,
    total_sold: Number(summary.total_sold || 0),
    sales_count: Number(summary.sales_count || 0),
    estimated_profit: canViewProfit ? Number(summary.estimated_profit || 0) : 0,
    by_payment: byPayment.map((row) => ({
      payment_method: row.payment_method,
      sales_count: Number(row.sales_count || 0),
      total_sold: Number(row.total_sold || 0),
    })),
    sold_products: soldProducts.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      total_quantity: Number(row.total_quantity || 0),
      gross_total: Number(row.gross_total || 0),
      estimated_profit: canViewProfit ? Number(row.estimated_profit || 0) : 0,
    })),
  };
}

/**
 * Consulta status de fechamento do caixa de uma data.
 * @param {string|undefined} date
 * @returns {Promise<Object>}
 */
async function getDailyCashClosureStatus(date) {
  const reportDate = resolveDailyDate(date);

  const closure = await reportRepository.findCashClosureByDate(reportDate);
  const normalized = normalizeCashClosure(closure);

  if (!normalized) {
    return { date: reportDate, closed: false };
  }

  return {
    date: reportDate,
    closed: true,
    closure: normalized,
  };
}

/**
 * Fecha oficialmente o caixa de uma data.
 * @param {{id:number,role:string}} actor
 * @param {string|undefined} date
 * @returns {Promise<Object>}
 */
async function closeDailyCash(actor, date) {
  const reportDate = toLocalDate();
  if (date) {
    const requestedDate = resolveDailyDate(date);
    if (requestedDate !== reportDate) {
      throw new AppError('Fechamento permitido apenas para a data atual do sistema.', 400, 'INVALID_CASH_CLOSE_DATE');
    }
  }

  const existing = await reportRepository.findCashClosureByDate(reportDate);
  if (existing) {
    throw new AppError('Caixa deste dia já foi fechado.', 400, 'CASH_ALREADY_CLOSED');
  }

  const [summary, byPayment] = await Promise.all([
    reportRepository.getDailySummary(reportDate),
    reportRepository.getDailySummaryByPayment(reportDate),
  ]);

  const normalizedPayments = byPayment.map((row) => ({
    payment_method: row.payment_method,
    sales_count: Number(row.sales_count || 0),
    total_sold: Number(row.total_sold || 0),
  }));

  await reportRepository.createCashClosure({
    closureDate: reportDate,
    totalSold: Number(summary.total_sold || 0),
    salesCount: Number(summary.sales_count || 0),
    byPaymentJson: JSON.stringify(normalizedPayments),
    closedByUserId: actor.id,
  });

  const closure = await reportRepository.findCashClosureByDate(reportDate);

  return {
    date: reportDate,
    closed: true,
    closure: normalizeCashClosure(closure),
  };
}

/**
 * Reabre o caixa do dia atual removendo o fechamento oficial.
 * Usado pelo admin para corrigir algo depois do fechamento.
 * @param {string|undefined} date
 * @returns {Promise<Object>}
 */
async function reopenDailyCash(date) {
  const reportDate = toLocalDate();
  if (date) {
    const requestedDate = resolveDailyDate(date);
    if (requestedDate !== reportDate) {
      throw new AppError('Reabertura permitida apenas para a data atual do sistema.', 400, 'INVALID_CASH_REOPEN_DATE');
    }
  }

  const existing = await reportRepository.findCashClosureByDate(reportDate);
  if (!existing) {
    throw new AppError('Caixa deste dia não está fechado.', 400, 'CASH_NOT_CLOSED');
  }

  await reportRepository.deleteCashClosureByDate(reportDate);

  return {
    date: reportDate,
    closed: false,
    reopened: true,
  };
}

/**
 * Dashboard mensal com comparativo com o mês anterior.
 * @param {number|string|undefined} year
 * @param {number|string|undefined} month
 * @returns {Promise<Object>}
 */
async function getMonthlyDashboard(year, month) {
  const current = resolveMonthRange(year, month);

  const previousMonthDate = new Date(Date.UTC(current.year, current.month - 2, 1));
  const previous = resolveMonthRange(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth() + 1);

  const [currentSummary, previousSummary, topProduct, currentByPayment, soldProducts] = await Promise.all([
    reportRepository.getMonthlySummary(current.startDate, current.endDate),
    reportRepository.getMonthlySummary(previous.startDate, previous.endDate),
    reportRepository.getTopSellingProduct(current.startDate, current.endDate),
    reportRepository.getMonthlySummaryByPayment(current.startDate, current.endDate),
    reportRepository.getMonthlySoldProducts(current.startDate, current.endDate),
  ]);

  return {
    current_month: {
      year: current.year,
      month: current.month,
      total_sold: Number(currentSummary.total_sold || 0),
      estimated_profit: Number(currentSummary.estimated_profit || 0),
      sales_count: Number(currentSummary.sales_count || 0),
      top_selling_product: topProduct
        ? { id: topProduct.id, name: topProduct.name, total_quantity: Number(topProduct.total_quantity || 0) }
        : null,
      by_payment: currentByPayment.map((row) => ({
        payment_method: row.payment_method,
        sales_count: Number(row.sales_count || 0),
        total_sold: Number(row.total_sold || 0),
      })),
      sold_products: soldProducts.map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        total_quantity: Number(row.total_quantity || 0),
        gross_total: Number(row.gross_total || 0),
        estimated_profit: Number(row.estimated_profit || 0),
      })),
    },
    previous_month: {
      year: previous.year,
      month: previous.month,
      total_sold: Number(previousSummary.total_sold || 0),
      estimated_profit: Number(previousSummary.estimated_profit || 0),
      sales_count: Number(previousSummary.sales_count || 0),
    },
    comparison: {
      total_sold_diff: Number((Number(currentSummary.total_sold || 0) - Number(previousSummary.total_sold || 0)).toFixed(2)),
      estimated_profit_diff: Number((Number(currentSummary.estimated_profit || 0) - Number(previousSummary.estimated_profit || 0)).toFixed(2)),
      sales_count_diff: Number(currentSummary.sales_count || 0) - Number(previousSummary.sales_count || 0),
    },
  };
}

/**
 * Gera relatório mensal em PDF.
 * @param {number|string|undefined} year
 * @param {number|string|undefined} month
 * @returns {Promise<{buffer:Buffer,fileName:string}>}
 */
async function generateMonthlyReportPdf(year, month) {
  const period = resolveMonthRange(year, month);

  const [summary, sales] = await Promise.all([
    reportRepository.getMonthlySummary(period.startDate, period.endDate),
    reportRepository.listMonthlyFinalizedSales(period.startDate, period.endDate),
  ]);

  const fileName = `relatorio-mensal-${period.year}-${String(period.month).padStart(2, '0')}.pdf`;

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Relatório Mensal - Essencial Cosméticos');
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Período: ${period.startDate} até ${period.endDate}`);
    doc.fontSize(11).text(`Total vendido: R$ ${Number(summary.total_sold || 0).toFixed(2)}`);
    doc.fontSize(11).text(`Lucro estimado: R$ ${Number(summary.estimated_profit || 0).toFixed(2)}`);
    doc.fontSize(11).text(`Quantidade de vendas: ${Number(summary.sales_count || 0)}`);
    doc.moveDown();
    doc.fontSize(12).text('Vendas recebidas:');
    doc.moveDown(0.5);

    if (sales.length === 0) {
      doc.fontSize(10).text('Nenhuma venda recebida no período.');
    } else {
      for (const sale of sales) {
        doc
          .fontSize(10)
          .text(
            `#${sale.id} | ${sale.created_at} | Pagamento: ${sale.payment_method} | Total: R$ ${Number(
              sale.total || 0
            ).toFixed(2)} | Cliente: ${sale.client_name || '-'}`
          );
      }
    }

    doc.end();
  });

  return { buffer, fileName };
}

module.exports = {
  getDailyCashSummary,
  getDailyCashClosureStatus,
  closeDailyCash,
  reopenDailyCash,
  getMonthlyDashboard,
  generateMonthlyReportPdf,
};
