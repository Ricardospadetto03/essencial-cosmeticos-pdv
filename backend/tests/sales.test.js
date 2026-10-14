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

async function openSaleWithItem(token, productId, quantity) {
  const sale = await request('POST', '/sales', { token, body: { client_name: 'Cliente Teste' } });
  await request('POST', `/sales/${sale.body.id}/items`, {
    token,
    body: { product_id: productId, quantity },
  });
  return sale.body.id;
}

async function getStock(token, productId) {
  const { body } = await request('GET', `/products/${productId}`, { token });
  return body.stock;
}

test('venda em dinheiro calcula troco e baixa o estoque', async () => {
  const token = await loginAsAdmin();
  const productId = await createProduct(token, { sale_price: 25, stock: 10 });
  const saleId = await openSaleWithItem(token, productId, 2);

  const { status, body } = await request('POST', `/sales/${saleId}/finalize`, {
    token,
    body: { payment_method: 'DINHEIRO', discount_percent: 10, amount_received: 50 },
  });

  assert.equal(status, 200);
  assert.equal(body.status, 'FINALIZED');
  assert.equal(body.total, 45); // 2 x 25 com 10% de desconto
  assert.equal(body.change_amount, 5);
  assert.equal(await getStock(token, productId), 8);
});

test('estoque insuficiente não finaliza a venda e não baixa nenhum item', async () => {
  const token = await loginAsAdmin();
  const productWithStock = await createProduct(token, { name: 'Com estoque', stock: 10 });
  const productWithoutStock = await createProduct(token, { name: 'Sem estoque', stock: 1 });

  const saleId = await openSaleWithItem(token, productWithStock, 3);
  await request('POST', `/sales/${saleId}/items`, {
    token,
    body: { product_id: productWithoutStock, quantity: 5 },
  });

  const { status, body } = await request('POST', `/sales/${saleId}/finalize`, {
    token,
    body: { payment_method: 'PIX' },
  });
  const sale = await request('GET', `/sales/${saleId}`, { token });

  assert.equal(status, 400);
  assert.equal(body.code, 'INSUFFICIENT_STOCK');
  assert.equal(sale.body.status, 'OPEN');
  // O primeiro item tinha estoque, mas a transação inteira foi desfeita.
  assert.equal(await getStock(token, productWithStock), 10);
  assert.equal(await getStock(token, productWithoutStock), 1);
});

test('desconto acima de 50% ou não numérico é rejeitado', async () => {
  const token = await loginAsAdmin();
  const productId = await createProduct(token);
  const saleId = await openSaleWithItem(token, productId, 1);

  for (const discount of [60, 'abc', -5]) {
    const { status, body } = await request('POST', `/sales/${saleId}/finalize`, {
      token,
      body: { payment_method: 'PIX', discount_percent: discount },
    });
    assert.equal(status, 400, `desconto ${discount}`);
    assert.equal(body.code, 'INVALID_DISCOUNT');
  }
});

test('venda já finalizada não pode ser finalizada de novo', async () => {
  const token = await loginAsAdmin();
  const productId = await createProduct(token, { stock: 10 });
  const saleId = await openSaleWithItem(token, productId, 1);

  const first = request('POST', `/sales/${saleId}/finalize`, { token, body: { payment_method: 'PIX' } });
  const second = request('POST', `/sales/${saleId}/finalize`, { token, body: { payment_method: 'PIX' } });
  const results = await Promise.all([first, second]);

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await getStock(token, productId), 9);
});

test('venda a prazo fica pendente e só entra no caixa quando é quitada', async () => {
  const token = await loginAsAdmin();
  const productId = await createProduct(token, { sale_price: 30, stock: 5 });
  const saleId = await openSaleWithItem(token, productId, 1);

  const cashBefore = await request('GET', '/cash/summary/daily', { token });
  await request('POST', `/sales/${saleId}/finalize`, { token, body: { payment_method: 'PRAZO' } });

  const pending = await request('GET', '/sales/pending/list', { token });
  assert.ok(pending.body.some((sale) => sale.id === saleId));
  assert.equal(await getStock(token, productId), 4);

  const cashAfterSale = await request('GET', '/cash/summary/daily', { token });
  assert.equal(cashAfterSale.body.total_sold, cashBefore.body.total_sold);

  const settle = await request('POST', `/sales/${saleId}/settle`, {
    token,
    body: { payment_method: 'DINHEIRO', amount_received: 50 },
  });
  assert.equal(settle.status, 200);
  assert.equal(settle.body.change_amount, 20);

  const cashAfterSettle = await request('GET', '/cash/summary/daily', { token });
  assert.equal(cashAfterSettle.body.total_sold, cashBefore.body.total_sold + 30);
  assert.equal(await getStock(token, productId), 4);
});

test('funcionário não acessa comanda aberta por outro usuário', async () => {
  const adminToken = await loginAsAdmin();
  const employeeToken = await loginAsEmployee();
  const sale = await request('POST', '/sales', { token: adminToken, body: { client_name: 'Cliente' } });

  const { status } = await request('GET', `/sales/${sale.body.id}`, { token: employeeToken });

  assert.equal(status, 403);
});

test('comanda aberta aparece na lista para ser retomada e some ao ser cancelada', async () => {
  const employeeToken = await loginAsEmployee();
  const adminToken = await loginAsAdmin();
  const sale = await request('POST', '/sales', { token: employeeToken, body: { client_name: 'Ana' } });
  await request('POST', '/sales', { token: adminToken, body: { client_name: 'Do admin' } });

  const asEmployee = await request('GET', '/sales/open/list', { token: employeeToken });
  assert.ok(asEmployee.body.some((open) => open.id === sale.body.id));
  assert.ok(asEmployee.body.every((open) => open.client_name !== 'Do admin'));

  await request('POST', `/sales/${sale.body.id}/cancel`, { token: employeeToken });
  const afterCancel = await request('GET', '/sales/open/list', { token: employeeToken });
  assert.ok(!afterCancel.body.some((open) => open.id === sale.body.id));
});

test('com o caixa fechado não é possível abrir comanda até o admin reabrir', async () => {
  const adminToken = await loginAsAdmin();
  const employeeToken = await loginAsEmployee();

  const close = await request('POST', '/cash/close', { token: employeeToken, body: {} });
  assert.equal(close.status, 200);

  const blocked = await request('POST', '/sales', { token: employeeToken, body: { client_name: 'X' } });
  assert.equal(blocked.status, 400);
  assert.equal(blocked.body.code, 'CASH_CLOSED');

  const employeeReopen = await request('POST', '/cash/reopen', { token: employeeToken, body: {} });
  assert.equal(employeeReopen.status, 403);

  const adminReopen = await request('POST', '/cash/reopen', { token: adminToken, body: {} });
  assert.equal(adminReopen.status, 200);

  const allowed = await request('POST', '/sales', { token: employeeToken, body: { client_name: 'X' } });
  assert.equal(allowed.status, 201);
});
