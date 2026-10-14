const { run, get, all } = require('../config/database');

// A data que vale para o caixa é a do recebimento (settled_at), não a da venda.
// Registros antigos foram gravados em UTC (com "T"/"Z") e são convertidos para
// o horário local antes de comparar.
const CASH_DATE_EXPR = `
  DATE(
    CASE
      WHEN settled_at LIKE '%T%' OR settled_at LIKE '%Z' THEN datetime(settled_at, 'localtime')
      ELSE settled_at
    END
  )
`;

/**
 * Resumo diário de vendas finalizadas.
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Object>}
 */
async function getDailySummary(date) {
  const sql = `
    SELECT
      COUNT(*) AS sales_count,
      COALESCE(SUM(s.total), 0) AS total_sold,
      COALESCE(SUM(
        s.total - (
          SELECT COALESCE(SUM(si.purchase_price_snapshot * si.quantity), 0)
          FROM sale_items si
          WHERE si.sale_id = s.id
        )
      ), 0) AS estimated_profit
    FROM sales s
    WHERE s.status = 'FINALIZED'
      AND s.settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} = DATE(?)
  `;
  return get(sql, [date]);
}

/**
 * Totais diários por forma de pagamento.
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Object[]>}
 */
async function getDailySummaryByPayment(date) {
  const sql = `
    SELECT
      payment_method,
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total_sold
    FROM sales
    WHERE status = 'FINALIZED'
      AND settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} = DATE(?)
    GROUP BY payment_method
    ORDER BY total_sold DESC
  `;
  return all(sql, [date]);
}

/**
 * Produtos vendidos no dia (agregado por produto).
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Object[]>}
 */
async function getDailySoldProducts(date) {
  const sql = `
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      COALESCE(SUM(si.quantity), 0) AS total_quantity,
      COALESCE(SUM(si.quantity * si.unit_price), 0) AS gross_total,
      COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price_snapshot)), 0) AS estimated_profit
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    INNER JOIN products p ON p.id = si.product_id
    WHERE s.status = 'FINALIZED'
      AND s.settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} = DATE(?)
    GROUP BY p.id, p.name
    ORDER BY total_quantity DESC, p.name ASC
  `;
  return all(sql, [date]);
}

/**
 * Produtos vendidos no mês (agregado por produto).
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Object[]>}
 */
async function getMonthlySoldProducts(startDate, endDate) {
  const sql = `
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      COALESCE(SUM(si.quantity), 0) AS total_quantity,
      COALESCE(SUM(si.quantity * si.unit_price), 0) AS gross_total,
      COALESCE(SUM(si.quantity * (si.unit_price - si.purchase_price_snapshot)), 0) AS estimated_profit
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    INNER JOIN products p ON p.id = si.product_id
    WHERE s.status = 'FINALIZED'
      AND s.settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} >= DATE(?)
      AND ${CASH_DATE_EXPR} <= DATE(?)
    GROUP BY p.id, p.name
    ORDER BY total_quantity DESC, p.name ASC
  `;
  return all(sql, [startDate, endDate]);
}

/**
 * Totais mensais de venda e lucro estimado.
 * Lucro estimado = total final da venda - custo total dos itens.
 *
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Object>}
 */
async function getMonthlySummary(startDate, endDate) {
  const sql = `
    SELECT
      COALESCE(SUM(s.total), 0) AS total_sold,
      COALESCE(SUM(
        s.total - (
          SELECT COALESCE(SUM(si.purchase_price_snapshot * si.quantity), 0)
          FROM sale_items si
          WHERE si.sale_id = s.id
        )
      ), 0) AS estimated_profit,
      COUNT(*) AS sales_count
    FROM sales s
    WHERE s.status = 'FINALIZED'
      AND s.settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} >= DATE(?)
      AND ${CASH_DATE_EXPR} <= DATE(?)
  `;
  return get(sql, [startDate, endDate]);
}

/**
 * Totais mensais por forma de pagamento.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Object[]>}
 */
async function getMonthlySummaryByPayment(startDate, endDate) {
  const sql = `
    SELECT
      payment_method,
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total_sold
    FROM sales
    WHERE status = 'FINALIZED'
      AND settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} >= DATE(?)
      AND ${CASH_DATE_EXPR} <= DATE(?)
    GROUP BY payment_method
    ORDER BY total_sold DESC
  `;
  return all(sql, [startDate, endDate]);
}

/**
 * Produto mais vendido no período.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Object|undefined>}
 */
async function getTopSellingProduct(startDate, endDate) {
  const sql = `
    SELECT
      p.id,
      p.name,
      COALESCE(SUM(si.quantity), 0) AS total_quantity
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    INNER JOIN products p ON p.id = si.product_id
    WHERE s.status = 'FINALIZED'
      AND s.settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} >= DATE(?)
      AND ${CASH_DATE_EXPR} <= DATE(?)
    GROUP BY p.id, p.name
    ORDER BY total_quantity DESC, p.name ASC
    LIMIT 1
  `;
  return get(sql, [startDate, endDate]);
}

/**
 * Lista vendas finalizadas do mês para relatório.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Object[]>}
 */
async function listMonthlyFinalizedSales(startDate, endDate) {
  const sql = `
    SELECT
      id,
      user_id,
      client_name,
      payment_method,
      total,
      discount_percent,
      settled_at,
      created_at
    FROM sales
    WHERE status = 'FINALIZED'
      AND settled_at IS NOT NULL
      AND ${CASH_DATE_EXPR} >= DATE(?)
      AND ${CASH_DATE_EXPR} <= DATE(?)
    ORDER BY settled_at ASC
  `;
  return all(sql, [startDate, endDate]);
}

/**
 * Busca fechamento de caixa por data.
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Object|undefined>}
 */
async function findCashClosureByDate(date) {
  const sql = `
    SELECT
      cc.id,
      cc.closure_date,
      cc.total_sold,
      cc.sales_count,
      cc.by_payment_json,
      cc.closed_by_user_id,
      cc.closed_at,
      u.name AS closed_by_name
    FROM cash_closures cc
    INNER JOIN users u ON u.id = cc.closed_by_user_id
    WHERE DATE(cc.closure_date) = DATE(?)
    LIMIT 1
  `;
  return get(sql, [date]);
}

/**
 * Cria registro de fechamento de caixa diário.
 * @param {{closureDate:string,totalSold:number,salesCount:number,byPaymentJson:string,closedByUserId:number}} data
 * @returns {Promise<{id:number}>}
 */
async function createCashClosure(data) {
  const sql = `
    INSERT INTO cash_closures (
      closure_date,
      total_sold,
      sales_count,
      by_payment_json,
      closed_by_user_id
    )
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await run(sql, [
    data.closureDate,
    data.totalSold,
    data.salesCount,
    data.byPaymentJson,
    data.closedByUserId,
  ]);
  return { id: result.lastID };
}

/**
 * Remove fechamento de caixa por data.
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<{changes:number}>}
 */
async function deleteCashClosureByDate(date) {
  const result = await run("DELETE FROM cash_closures WHERE DATE(closure_date) = DATE(?)", [date]);
  return { changes: Number(result?.changes || 0) };
}

module.exports = {
  getDailySummary,
  getDailySummaryByPayment,
  getDailySoldProducts,
  getMonthlySoldProducts,
  getMonthlySummary,
  getMonthlySummaryByPayment,
  getTopSellingProduct,
  listMonthlyFinalizedSales,
  findCashClosureByDate,
  createCashClosure,
  deleteCashClosureByDate,
};
