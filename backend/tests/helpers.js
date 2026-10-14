const fs = require('fs');
const os = require('os');
const path = require('path');

// Cada arquivo de teste roda em um processo separado (node --test), então
// cada um ganha um banco novo em uma pasta temporária.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'essencial-test-'));
process.env.DATABASE_DIR = tempDir;
process.env.BACKUP_DIRECTORY = path.join(tempDir, 'backups');
process.env.JWT_SECRET = 'segredo-de-teste';

const app = require('../src/app');
const { initializeDatabase, closeDatabase } = require('../src/config/database');
const { seedUsers } = require('../src/database/seedUsers');

let server;
let baseUrl;

async function startServer() {
  await initializeDatabase();
  await seedUsers();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
}

async function stopServer() {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * @param {string} method
 * @param {string} url
 * @param {{ token?: string, body?: object }} [options]
 * @returns {Promise<{ status: number, body: any }>}
 */
async function request(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(baseUrl + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  return {
    status: response.status,
    body: isJson ? await response.json() : await response.text(),
  };
}

async function login(email, password) {
  const { body } = await request('POST', '/auth/login', { body: { email, password } });
  return body.token;
}

const loginAsAdmin = () => login('admin@essencial.com', 'admin123');
const loginAsEmployee = () => login('funcionario@essencial.com', 'func123');

async function createProduct(token, overrides = {}) {
  const { body } = await request('POST', '/products', {
    token,
    body: {
      name: 'Batom Matte',
      brand: 'Marca X',
      purchase_price: 10,
      sale_price: 25,
      stock: 10,
      minimum_stock: 2,
      ...overrides,
    },
  });
  return body.id;
}

module.exports = {
  startServer,
  stopServer,
  request,
  login,
  loginAsAdmin,
  loginAsEmployee,
  createProduct,
};
