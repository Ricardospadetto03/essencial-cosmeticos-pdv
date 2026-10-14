// Popula o banco com produtos e vendas de exemplo para testar o sistema.
// Uso: npm run seed:demo (só roda se ainda não houver produtos cadastrados).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const { initializeDatabase, closeDatabase, get } = require('../config/database');
const { seedUsers } = require('./seedUsers');
const productService = require('../services/productService');
const saleService = require('../services/saleService');

const DEMO_PRODUCTS = [
  { name: 'Batom Matte Vermelho', brand: 'Vult', purchase_price: 12.9, sale_price: 29.9, stock: 24, minimum_stock: 5 },
  { name: 'Base Líquida HD', brand: 'Ruby Rose', purchase_price: 18.5, sale_price: 42.0, stock: 12, minimum_stock: 4 },
  { name: 'Máscara de Cílios', brand: 'Maybelline', purchase_price: 22.0, sale_price: 54.9, stock: 3, minimum_stock: 5 },
  { name: 'Hidratante Corporal 400ml', brand: 'Nivea', purchase_price: 15.0, sale_price: 32.5, stock: 18, minimum_stock: 6 },
  { name: 'Shampoo Hidratação', brand: 'Elseve', size: 'M', purchase_price: 11.0, sale_price: 24.9, stock: 2, minimum_stock: 6 },
  { name: 'Perfume Floral 100ml', brand: 'Natura', size: 'G', purchase_price: 89.0, sale_price: 179.9, stock: 6, minimum_stock: 2 },
  { name: 'Protetor Solar FPS 50', brand: 'La Roche', purchase_price: 45.0, sale_price: 89.9, stock: 9, minimum_stock: 3, expiringInDays: 20 },
  { name: 'Esmalte Nude', brand: 'Risqué', purchase_price: 3.2, sale_price: 8.9, stock: 40, minimum_stock: 10 },
];

function dateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function createSale(actor, clientName, items, finalizePayload) {
  const { id } = await saleService.createSale(actor, { client_name: clientName });
  for (const [productId, quantity] of items) {
    await saleService.addSaleItem(actor, id, { product_id: productId, quantity });
  }
  if (finalizePayload) {
    await saleService.finalizeSale(actor, id, finalizePayload);
  }
  return id;
}

async function seedDemo() {
  await initializeDatabase();
  await seedUsers();

  const { count } = await get('SELECT COUNT(*) AS count FROM products');
  if (count > 0) {
    console.log('O banco já tem produtos cadastrados. Nada foi alterado.');
    return;
  }

  const ids = [];
  for (const { expiringInDays, ...product } of DEMO_PRODUCTS) {
    const expiration_date = expiringInDays ? dateInDays(expiringInDays) : null;
    const { id } = await productService.createProduct({ ...product, expiration_date });
    ids.push(id);
  }

  const admin = await get("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1");
  const actor = { userId: admin.id, role: 'ADMIN' };

  await createSale(actor, 'Juliana Souza', [[ids[0], 2], [ids[7], 3]], {
    payment_method: 'DINHEIRO',
    amount_received: 100,
  });
  await createSale(actor, 'Carla Mendes', [[ids[5], 1]], { payment_method: 'PIX', discount_percent: 10 });
  await createSale(actor, 'Patrícia Lima', [[ids[1], 1], [ids[3], 2]], { payment_method: 'CARTAO' });
  await createSale(actor, 'Fernanda Rocha', [[ids[6], 1]], { payment_method: 'PRAZO' });
  await createSale(actor, 'Mariana Alves', [[ids[2], 1]], null);

  console.log(`Dados de demonstração criados: ${ids.length} produtos e 5 comandas.`);
}

seedDemo()
  .catch((error) => {
    console.error('Falha ao criar dados de demonstração:', error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
