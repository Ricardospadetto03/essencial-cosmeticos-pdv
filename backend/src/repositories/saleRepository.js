const database = require('../config/database');

const SALE_COLUMNS = `
  id, user_id, client_name, status, discount_percent, payment_method,
  total, amount_received, change_amount, settled_at, created_at
`;

async function createSale(data) {
  const result = await database.run(
    `
      INSERT INTO sales (user_id, client_name, status, discount_percent, total)
      VALUES (?, ?, 'OPEN', 0, 0)
    `,
    [data.user_id, data.client_name || null]
  );
  return { id: result.lastID };
}

async function findSaleById(saleId, db = database) {
  return db.get(`SELECT ${SALE_COLUMNS} FROM sales WHERE id = ?`, [saleId]);
}

async function listSaleItems(saleId, db = database) {
  return db.all(
    `
      SELECT
        si.id,
        si.sale_id,
        si.product_id,
        p.name AS product_name,
        p.brand AS product_brand,
        p.size AS product_size,
        si.quantity,
        si.unit_price,
        si.purchase_price_snapshot
      FROM sale_items si
      INNER JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `,
    [saleId]
  );
}

async function findSaleItemById(saleItemId) {
  return database.get(
    `
      SELECT id, sale_id, product_id, quantity, unit_price, purchase_price_snapshot
      FROM sale_items
      WHERE id = ?
    `,
    [saleItemId]
  );
}

async function createSaleItem(data) {
  const result = await database.run(
    `
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, purchase_price_snapshot)
      VALUES (?, ?, ?, ?, ?)
    `,
    [data.sale_id, data.product_id, data.quantity, data.unit_price, data.purchase_price_snapshot]
  );
  return { id: result.lastID };
}

async function deleteSaleItem(saleItemId) {
  const result = await database.run('DELETE FROM sale_items WHERE id = ?', [saleItemId]);
  return { changes: result.changes };
}

async function updateSaleTotal(saleId, total) {
  const result = await database.run('UPDATE sales SET total = ? WHERE id = ?', [total, saleId]);
  return { changes: result.changes };
}

/**
 * Finaliza a venda. O filtro `status = 'OPEN'` impede finalizar duas vezes
 * (ex: duplo clique no botão): a segunda chamada retorna changes = 0.
 */
async function finalizeSale(data, db = database) {
  const result = await db.run(
    `
      UPDATE sales
      SET
        status = 'FINALIZED',
        payment_method = ?,
        total = ?,
        discount_percent = ?,
        amount_received = ?,
        change_amount = ?,
        settled_at = ?
      WHERE id = ? AND status = 'OPEN'
    `,
    [
      data.paymentMethod,
      data.total,
      data.discountPercent,
      data.amountReceived,
      data.changeAmount,
      data.settledAt,
      data.saleId,
    ]
  );
  return { changes: result.changes };
}

async function cancelSale(saleId) {
  const result = await database.run(
    "UPDATE sales SET status = 'CANCELED' WHERE id = ? AND status = 'OPEN'",
    [saleId]
  );
  return { changes: result.changes };
}

/**
 * Registra o recebimento de uma venda a prazo. O estoque já foi baixado
 * quando a venda foi finalizada.
 */
async function settlePendingSale(data) {
  const result = await database.run(
    `
      UPDATE sales
      SET payment_method = ?, amount_received = ?, change_amount = ?, settled_at = ?
      WHERE id = ? AND settled_at IS NULL
    `,
    [data.paymentMethod, data.amountReceived, data.changeAmount, data.settledAt, data.saleId]
  );
  return { changes: result.changes };
}

/**
 * Comandas abertas (ainda não finalizadas nem canceladas).
 * @param {{userId?: number}} [options] filtra pelo vendedor
 */
async function listOpenSales({ userId } = {}) {
  const conditions = ["status = 'OPEN'"];
  const params = [];

  if (userId !== undefined) {
    conditions.push('user_id = ?');
    params.push(userId);
  }

  return database.all(
    `SELECT ${SALE_COLUMNS} FROM sales WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
}

/**
 * Vendas a prazo ainda não quitadas.
 * @param {{userId?: number}} [options] filtra pelo vendedor
 */
async function listPendingSales({ userId } = {}) {
  const conditions = ["status = 'FINALIZED'", "payment_method = 'PRAZO'", 'settled_at IS NULL'];
  const params = [];

  if (userId !== undefined) {
    conditions.push('user_id = ?');
    params.push(userId);
  }

  return database.all(
    `SELECT ${SALE_COLUMNS} FROM sales WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`,
    params
  );
}

function buildHistoryFilter(userId) {
  const conditions = ["status = 'FINALIZED'"];
  const params = [];

  if (userId !== undefined) {
    conditions.push('user_id = ?');
    params.push(userId);
  }

  return { where: conditions.join(' AND '), params };
}

/**
 * @param {{ userId?: number, limit?: number, offset?: number }} [options]
 */
async function listFinalizedSalesHistory({ userId, limit, offset } = {}) {
  const { where, params } = buildHistoryFilter(userId);
  let sql = `SELECT ${SALE_COLUMNS} FROM sales WHERE ${where} ORDER BY created_at DESC`;

  if (limit !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return database.all(sql, params);
}

async function countFinalizedSalesHistory({ userId } = {}) {
  const { where, params } = buildHistoryFilter(userId);
  const row = await database.get(`SELECT COUNT(*) AS count FROM sales WHERE ${where}`, params);
  return row ? row.count : 0;
}

module.exports = {
  createSale,
  findSaleById,
  listSaleItems,
  findSaleItemById,
  createSaleItem,
  deleteSaleItem,
  updateSaleTotal,
  finalizeSale,
  cancelSale,
  settlePendingSale,
  listOpenSales,
  listPendingSales,
  listFinalizedSalesHistory,
  countFinalizedSalesHistory,
};
