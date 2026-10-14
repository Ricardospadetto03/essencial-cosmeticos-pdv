const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

// DATABASE_DIR é definido pelo Electron para gravar o banco na pasta de dados
// do usuário. Rodando só o backend, o banco fica em backend/database.
const databaseDirectory = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.resolve(__dirname, '../../database');

const databasePath = path.join(databaseDirectory, 'sistema.sqlite');
const schemaPath = path.resolve(__dirname, '../database/schema.sql');

let db = null;

function openConnection() {
  fs.mkdirSync(databaseDirectory, { recursive: true });

  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(databasePath, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
}

function closeConnection(connection) {
  return new Promise((resolve, reject) => {
    connection.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * Cria funções run/get/all com Promise em cima de uma conexão do sqlite3
 * (que trabalha com callbacks).
 * @param {sqlite3.Database} connection
 */
function createExecutor(connection) {
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        connection.run(sql, params, function onRun(error) {
          if (error) reject(error);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        connection.get(sql, params, (error, row) => {
          if (error) reject(error);
          else resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        connection.all(sql, params, (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        connection.exec(sql, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

async function configureConnection(executor) {
  // SQLite vem com foreign keys desligadas por padrão.
  await executor.run('PRAGMA foreign_keys = ON;');
  // Se outra conexão estiver escrevendo, espera até 5s em vez de falhar na hora.
  await executor.run('PRAGMA busy_timeout = 5000;');
}

/**
 * Adiciona colunas que não existiam nas primeiras versões da tabela sales,
 * para que bancos antigos continuem funcionando sem recriar nada.
 */
async function migrateSalesTable(executor) {
  const columns = await executor.all('PRAGMA table_info(sales);');
  const hasColumn = (name) => columns.some((column) => column.name === name);

  if (!hasColumn('amount_received')) {
    await executor.run('ALTER TABLE sales ADD COLUMN amount_received REAL;');
  }
  if (!hasColumn('change_amount')) {
    await executor.run('ALTER TABLE sales ADD COLUMN change_amount REAL DEFAULT 0;');
  }
  if (!hasColumn('settled_at')) {
    await executor.run('ALTER TABLE sales ADD COLUMN settled_at DATETIME;');
    // Vendas à vista antigas foram recebidas no momento da venda.
    await executor.run(`
      UPDATE sales
      SET settled_at = created_at
      WHERE status = 'FINALIZED'
        AND payment_method IN ('DINHEIRO', 'PIX', 'CARTAO')
        AND settled_at IS NULL;
    `);
  }

  // Criado aqui (e não no schema.sql) porque settled_at pode ter acabado de
  // ser adicionada pela migração acima.
  await executor.run('CREATE INDEX IF NOT EXISTS idx_sales_settled_at ON sales(settled_at);');
}

async function initializeDatabase() {
  if (db) {
    return db;
  }

  const connection = await openConnection();
  const executor = createExecutor(connection);

  await configureConnection(executor);
  // WAL permite ler enquanto outra conexão está escrevendo.
  await executor.run('PRAGMA journal_mode = WAL;');
  await executor.exec(fs.readFileSync(schemaPath, 'utf-8'));
  await migrateSalesTable(executor);

  db = connection;
  return db;
}

async function getExecutor() {
  return createExecutor(await initializeDatabase());
}

async function run(sql, params) {
  return (await getExecutor()).run(sql, params);
}

async function get(sql, params) {
  return (await getExecutor()).get(sql, params);
}

async function all(sql, params) {
  return (await getExecutor()).all(sql, params);
}

/**
 * Executa `callback` dentro de uma transação.
 *
 * Cada transação abre uma conexão própria. Se usasse a conexão compartilhada,
 * comandos de outras requisições que chegassem no meio (ex: alguém adicionando
 * item em outra comanda) entrariam na mesma transação, e um ROLLBACK aqui
 * desfaria o trabalho delas também.
 *
 * BEGIN IMMEDIATE já reserva a escrita no início, então duas transações não
 * conseguem ler o mesmo estoque e baixar ao mesmo tempo.
 *
 * @template T
 * @param {(tx: {run: Function, get: Function, all: Function}) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withTransaction(callback) {
  await initializeDatabase();
  const connection = await openConnection();
  const tx = createExecutor(connection);

  try {
    await configureConnection(tx);
    await tx.run('BEGIN IMMEDIATE');

    try {
      const result = await callback(tx);
      await tx.run('COMMIT');
      return result;
    } catch (error) {
      await tx.run('ROLLBACK');
      throw error;
    }
  } finally {
    await closeConnection(connection);
  }
}

async function closeDatabase() {
  if (db) {
    const connection = db;
    db = null;
    await closeConnection(connection);
  }
}

module.exports = {
  initializeDatabase,
  closeDatabase,
  withTransaction,
  run,
  get,
  all,
  databasePath,
};
