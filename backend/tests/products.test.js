const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startServer,
  stopServer,
  request,
  loginAsAdmin,
  loginAsEmployee,
  createProduct,
} = require('./helpers');

before(startServer);
after(stopServer);

test('funcionário não recebe o preço de custo dos produtos', async () => {
  const adminToken = await loginAsAdmin();
  const employeeToken = await loginAsEmployee();
  const productId = await createProduct(adminToken);

  const asAdmin = await request('GET', `/products/${productId}`, { token: adminToken });
  const asEmployee = await request('GET', `/products/${productId}`, { token: employeeToken });

  assert.equal(asAdmin.body.purchase_price, 10);
  assert.equal(asEmployee.body.purchase_price, undefined);
  assert.equal(asEmployee.body.sale_price, 25);
});

test('funcionário não pode cadastrar produto', async () => {
  const employeeToken = await loginAsEmployee();

  const { status } = await request('POST', '/products', {
    token: employeeToken,
    body: { name: 'X', purchase_price: 1, sale_price: 2 },
  });

  assert.equal(status, 403);
});

test('preço não numérico é rejeitado', async () => {
  const adminToken = await loginAsAdmin();

  const { status, body } = await request('POST', '/products', {
    token: adminToken,
    body: { name: 'X', purchase_price: 'abc', sale_price: 2 },
  });

  assert.equal(status, 400);
  assert.equal(body.code, 'INVALID_PRICE');
});

test('entrada e ajuste de estoque atualizam o saldo', async () => {
  const adminToken = await loginAsAdmin();
  const productId = await createProduct(adminToken, { stock: 5 });

  const entry = await request('POST', `/products/${productId}/stock/entry`, {
    token: adminToken,
    body: { quantity: 3 },
  });
  assert.equal(entry.body.stock, 8);

  const adjustment = await request('POST', `/products/${productId}/stock/adjustment`, {
    token: adminToken,
    body: { quantity: -2 },
  });
  assert.equal(adjustment.body.stock, 6);
});

test('ajuste que deixaria o estoque negativo é rejeitado e o saldo não muda', async () => {
  const adminToken = await loginAsAdmin();
  const productId = await createProduct(adminToken, { stock: 2 });

  const { status } = await request('POST', `/products/${productId}/stock/adjustment`, {
    token: adminToken,
    body: { quantity: -5 },
  });
  const product = await request('GET', `/products/${productId}`, { token: adminToken });

  assert.equal(status, 400);
  assert.equal(product.body.stock, 2);
});

test('produto com movimentação de estoque não pode ser excluído', async () => {
  const adminToken = await loginAsAdmin();
  const productId = await createProduct(adminToken);
  await request('POST', `/products/${productId}/stock/entry`, { token: adminToken, body: { quantity: 1 } });

  const { status, body } = await request('DELETE', `/products/${productId}`, { token: adminToken });

  assert.equal(status, 409);
  assert.equal(body.code, 'PRODUCT_IN_USE');
});

test('produto sem histórico pode ser excluído', async () => {
  const adminToken = await loginAsAdmin();
  const productId = await createProduct(adminToken);

  const { status } = await request('DELETE', `/products/${productId}`, { token: adminToken });
  const after = await request('GET', `/products/${productId}`, { token: adminToken });

  assert.equal(status, 200);
  assert.equal(after.status, 404);
});
