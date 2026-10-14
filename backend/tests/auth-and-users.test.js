const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, request, login, loginAsAdmin, loginAsEmployee } = require('./helpers');

before(startServer);
after(stopServer);

test('login com credenciais corretas devolve token e dados do usuário', async () => {
  const { status, body } = await request('POST', '/auth/login', {
    body: { email: 'ADMIN@essencial.com ', password: 'admin123' },
  });

  assert.equal(status, 200);
  assert.ok(body.token);
  assert.equal(body.user.role, 'ADMIN');
  assert.equal(body.user.password, undefined);
});

test('login com senha errada devolve 401', async () => {
  const { status, body } = await request('POST', '/auth/login', {
    body: { email: 'admin@essencial.com', password: 'errada' },
  });

  assert.equal(status, 401);
  assert.equal(body.code, 'INVALID_CREDENTIALS');
});

test('rota protegida sem token devolve 401', async () => {
  const { status } = await request('GET', '/products');
  assert.equal(status, 401);
});

test('admin cadastra usuário e o novo usuário consegue logar', async () => {
  const adminToken = await loginAsAdmin();

  const { status, body } = await request('POST', '/users', {
    token: adminToken,
    body: { name: 'Maria', email: 'maria@essencial.com', password: 'senha123', role: 'FUNCIONARIO' },
  });

  assert.equal(status, 201);
  assert.equal(body.email, 'maria@essencial.com');
  assert.equal(body.password, undefined);
  assert.ok(await login('maria@essencial.com', 'senha123'));
});

test('cadastro com email repetido devolve 409', async () => {
  const adminToken = await loginAsAdmin();

  const { status } = await request('POST', '/users', {
    token: adminToken,
    body: { name: 'Outro', email: 'admin@essencial.com', password: 'senha123', role: 'ADMIN' },
  });

  assert.equal(status, 409);
});

test('funcionário não pode cadastrar usuários', async () => {
  const employeeToken = await loginAsEmployee();

  const { status } = await request('POST', '/users', {
    token: employeeToken,
    body: { name: 'X', email: 'x@essencial.com', password: 'senha123', role: 'ADMIN' },
  });

  assert.equal(status, 403);
});

test('funcionário vê apenas o próprio usuário na listagem', async () => {
  const employeeToken = await loginAsEmployee();

  const { status, body } = await request('GET', '/users', { token: employeeToken });

  assert.equal(status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0].email, 'funcionario@essencial.com');
});

test('não é possível rebaixar o último administrador', async () => {
  const adminToken = await loginAsAdmin();

  const { status, body } = await request('PUT', '/users/1', {
    token: adminToken,
    body: { role: 'FUNCIONARIO' },
  });

  assert.equal(status, 409);
  assert.equal(body.code, 'LAST_ADMIN_DEMOTE_FORBIDDEN');
});
