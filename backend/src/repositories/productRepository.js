const database = require('../config/database');

// As funções que recebem `db` podem rodar dentro de uma transação
// (withTransaction passa o `tx`). Sem o parâmetro, usam a conexão padrão.

const PRODUCT_COLUMNS = `
  id, name, brand, size, purchase_price, sale_price,
  stock, minimum_stock, expiration_date, created_at
`;

async function createProduct(data) {
  const result = await database.run(
    `
      INSERT INTO products (name, brand, size, purchase_price, sale_price, stock, minimum_stock, expiration_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.name,
      data.brand || null,
      data.size || null,
      data.purchase_price,
      data.sale_price,
      data.stock ?? 0,
      data.minimum_stock ?? 0,
      data.expiration_date || null,
    ]
  );

  return { id: result.lastID };
}

async function findProductById(id, db = database) {
  return db.get(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [id]);
}

/**
 * @param {string} [search] filtro por parte do nome
 */
async function listProducts(search) {
  if (search) {
    return database.all(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE name LIKE ? ORDER BY name ASC`,
      [`%${search}%`]
    );
  }

  return database.all(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY name ASC`);
}

/**
 * Atualiza só as colunas presentes em `fields`.
 * As chaves vêm do service (lista fixa), nunca direto do body da requisição.
 * @param {number} id
 * @param {Record<string, any>} fields
 */
async function updateProduct(id, fields) {
  const entries = Object.entries(fields);
  const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await database.run(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, id]);
  return { changes: result.changes };
}

async function deleteProduct(id) {
  const result = await database.run('DELETE FROM products WHERE id = ?', [id]);
  return { changes: result.changes };
}

async function updateProductStock(id, newStock, db = database) {
  const result = await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
  return { changes: result.changes };
}

/**
 * @param {{product_id:number, type:'ENTRY'|'ADJUSTMENT'|'SALE', quantity:number, reference_id?:number|null}} movement
 */
async function createStockMovement(movement, db = database) {
  const result = await db.run(
    'INSERT INTO stock_movements (product_id, type, quantity, reference_id) VALUES (?, ?, ?, ?)',
    [movement.product_id, movement.type, movement.quantity, movement.reference_id ?? null]
  );
  return { id: result.lastID };
}

async function listLowStockProducts() {
  return database.all(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE stock <= minimum_stock ORDER BY stock ASC, name ASC`
  );
}

/**
 * @param {string} limitDate YYYY-MM-DD
 */
async function listExpiringProducts(limitDate) {
  return database.all(
    `
      SELECT ${PRODUCT_COLUMNS}
      FROM products
      WHERE expiration_date IS NOT NULL
        AND expiration_date <= ?
      ORDER BY expiration_date ASC, name ASC
    `,
    [limitDate]
  );
}

/**
 * Produtos abaixo do estoque mínimo ou do limite informado, com a quantidade
 * sugerida para compra. Ignora os que foram dispensados manualmente.
 * @param {number} threshold
 */
async function listReplenishment(threshold) {
  return database.all(
    `
      SELECT
        ${PRODUCT_COLUMNS},
        CASE
          WHEN minimum_stock > ? THEN (minimum_stock - stock)
          ELSE (? - stock)
        END AS quantity_to_replenish
      FROM products
      WHERE (stock < minimum_stock OR stock < ?)
        AND id NOT IN (SELECT product_id FROM replenishment_exclusions)
      ORDER BY quantity_to_replenish DESC, name ASC
    `,
    [threshold, threshold, threshold]
  );
}

async function dismissReplenishment(productId) {
  const result = await database.run(
    'INSERT OR IGNORE INTO replenishment_exclusions (product_id) VALUES (?)',
    [productId]
  );
  return { changes: result.changes };
}

async function restoreReplenishment(productId, db = database) {
  const result = await db.run('DELETE FROM replenishment_exclusions WHERE product_id = ?', [productId]);
  return { changes: result.changes };
}

module.exports = {
  createProduct,
  findProductById,
  listProducts,
  updateProduct,
  deleteProduct,
  updateProductStock,
  createStockMovement,
  listLowStockProducts,
  listExpiringProducts,
  listReplenishment,
  dismissReplenishment,
  restoreReplenishment,
};
