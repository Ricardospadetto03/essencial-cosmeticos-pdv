const { run, get, all } = require('../config/database');

// Nenhuma consulta de listagem retorna o hash da senha.
// Só findByEmail traz o campo password, porque o login precisa dele.

async function createUser({ name, email, password, role }) {
  const result = await run(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, password, role]
  );
  return { id: result.lastID };
}

async function findByEmail(email) {
  return get('SELECT id, name, email, password, role, created_at FROM users WHERE email = ?', [email]);
}

async function findById(id) {
  return get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
}

/**
 * @param {{limit?: number, offset?: number}} [pagination]
 */
async function listUsers({ limit, offset } = {}) {
  let sql = 'SELECT id, name, email, role, created_at FROM users ORDER BY id DESC';
  const params = [];

  if (limit !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return all(sql, params);
}

async function countUsers() {
  const row = await get('SELECT COUNT(*) AS count FROM users');
  return row ? row.count : 0;
}

async function countByRole(role) {
  const row = await get('SELECT COUNT(*) AS count FROM users WHERE role = ?', [role]);
  return row ? row.count : 0;
}

/**
 * Atualiza só as colunas presentes em `fields` (chaves definidas pelo service).
 * @param {number} id
 * @param {Record<string, any>} fields
 */
async function updateUser(id, fields) {
  const entries = Object.entries(fields);
  const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await run(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id]);
  return { changes: result.changes };
}

async function deleteUser(id) {
  const result = await run('DELETE FROM users WHERE id = ?', [id]);
  return { changes: result.changes };
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  listUsers,
  countUsers,
  countByRole,
  updateUser,
  deleteUser,
};
