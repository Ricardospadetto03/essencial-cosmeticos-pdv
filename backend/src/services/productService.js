const PDFDocument = require('pdfkit');
const AppError = require('../shared/AppError');
const { withTransaction } = require('../config/database');
const { ROLES } = require('../shared/roles');
const { parseId, assertPayload, isValidNumber } = require('../shared/validation');
const { toLocalDate } = require('../shared/dates');
const productRepository = require('../repositories/productRepository');

const VALID_SIZES = ['P', 'M', 'G', 'GG'];
const DEFAULT_REPLENISHMENT_THRESHOLD = 5;
const DEFAULT_EXPIRATION_DAYS = 30;

/**
 * Funcionário não pode ver o preço de custo (purchase_price).
 */
function hideCostForRole(product, role) {
  if (!product || role === ROLES.ADMIN) {
    return product;
  }
  const { purchase_price, ...productWithoutCost } = product;
  return productWithoutCost;
}

function hideCostForList(products, role) {
  return products.map((product) => hideCostForRole(product, role));
}

function parseThreshold(rawThreshold) {
  if (rawThreshold === undefined) {
    return DEFAULT_REPLENISHMENT_THRESHOLD;
  }

  const threshold = Number(rawThreshold);
  if (!Number.isInteger(threshold) || threshold < 0) {
    throw new AppError('Parâmetro threshold inválido.', 400, 'INVALID_THRESHOLD');
  }
  return threshold;
}

function parsePrice(value, label) {
  if (!isValidNumber(value) || Number(value) < 0) {
    throw new AppError(`${label} inválido.`, 400, 'INVALID_PRICE');
  }
  return Number(value);
}

function parseNonNegativeInteger(value, label, code) {
  const number = Number(value);
  if (!isValidNumber(value) || !Number.isInteger(number) || number < 0) {
    throw new AppError(`${label} inválido.`, 400, code);
  }
  return number;
}

function parseSize(size) {
  if (size === undefined || size === null || size === '') {
    return null;
  }
  if (!VALID_SIZES.includes(size)) {
    throw new AppError('Tamanho inválido. Use P, M, G ou GG.', 400, 'INVALID_SIZE');
  }
  return size;
}

function parseExpirationDate(value) {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new AppError('Data de validade inválida. Use AAAA-MM-DD.', 400, 'INVALID_EXPIRATION_DATE');
  }
  return value;
}

async function findProductOrFail(id) {
  const product = await productRepository.findProductById(id);
  if (!product) {
    throw new AppError('Produto não encontrado.', 404, 'PRODUCT_NOT_FOUND');
  }
  return product;
}

async function createProduct(payload) {
  assertPayload(payload);

  const name = String(payload.name || '').trim();
  if (!name) {
    throw new AppError('O nome do produto é obrigatório.', 400, 'VALIDATION_ERROR');
  }

  return productRepository.createProduct({
    name,
    brand: payload.brand ? String(payload.brand).trim() : null,
    size: parseSize(payload.size),
    purchase_price: parsePrice(payload.purchase_price, 'Preço de custo'),
    sale_price: parsePrice(payload.sale_price, 'Preço de venda'),
    stock: parseNonNegativeInteger(payload.stock ?? 0, 'Estoque inicial', 'INVALID_STOCK'),
    minimum_stock: parseNonNegativeInteger(
      payload.minimum_stock ?? 0,
      'Estoque mínimo',
      'INVALID_MINIMUM_STOCK'
    ),
    expiration_date: parseExpirationDate(payload.expiration_date),
  });
}

async function getProductById(id, role) {
  const product = await findProductOrFail(parseId(id));
  return hideCostForRole(product, role);
}

async function listProducts(filters, role) {
  const search = filters?.search ? String(filters.search).trim() : undefined;
  const products = await productRepository.listProducts(search);
  return hideCostForList(products, role);
}

/**
 * Atualiza apenas os campos enviados. O estoque não é editável por aqui:
 * para isso existem entrada e ajuste, que registram o movimento.
 */
async function updateProduct(id, payload) {
  const productId = parseId(id);
  assertPayload(payload);
  await findProductOrFail(productId);

  const updateData = {};

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new AppError('O nome do produto é obrigatório.', 400, 'INVALID_NAME');
    }
    updateData.name = name;
  }
  if (payload.brand !== undefined) {
    updateData.brand = payload.brand ? String(payload.brand).trim() : null;
  }
  if (payload.size !== undefined) {
    updateData.size = parseSize(payload.size);
  }
  if (payload.purchase_price !== undefined) {
    updateData.purchase_price = parsePrice(payload.purchase_price, 'Preço de custo');
  }
  if (payload.sale_price !== undefined) {
    updateData.sale_price = parsePrice(payload.sale_price, 'Preço de venda');
  }
  if (payload.minimum_stock !== undefined) {
    updateData.minimum_stock = parseNonNegativeInteger(
      payload.minimum_stock,
      'Estoque mínimo',
      'INVALID_MINIMUM_STOCK'
    );
  }
  if (payload.expiration_date !== undefined) {
    updateData.expiration_date = parseExpirationDate(payload.expiration_date);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('Nenhum campo válido para atualização.', 400, 'NO_UPDATE_FIELDS');
  }

  await productRepository.updateProduct(productId, updateData);
  return productRepository.findProductById(productId);
}

async function deleteProduct(id) {
  const productId = parseId(id);
  await findProductOrFail(productId);

  try {
    return await productRepository.deleteProduct(productId);
  } catch (error) {
    if (String(error.message).includes('FOREIGN KEY constraint failed')) {
      throw new AppError(
        'Este produto já tem vendas ou movimentações registradas e não pode ser excluído.',
        409,
        'PRODUCT_IN_USE'
      );
    }
    throw error;
  }
}

/**
 * Soma `quantity` ao estoque e registra o movimento na mesma transação.
 * Entrada (ENTRY) só aceita valores positivos; ajuste (ADJUSTMENT) aceita
 * negativos, desde que o estoque não fique abaixo de zero.
 */
async function changeStock(rawProductId, rawQuantity, type) {
  const productId = parseId(rawProductId);
  const quantity = Number(rawQuantity);

  const isValidQuantity = type === 'ENTRY' ? quantity > 0 : quantity !== 0;
  if (!Number.isInteger(quantity) || !isValidQuantity) {
    throw new AppError('Quantidade inválida.', 400, 'INVALID_STOCK_QUANTITY');
  }

  await withTransaction(async (tx) => {
    const product = await productRepository.findProductById(productId, tx);
    if (!product) {
      throw new AppError('Produto não encontrado.', 404, 'PRODUCT_NOT_FOUND');
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new AppError(
        `O ajuste deixaria o estoque negativo (atual: ${product.stock}).`,
        400,
        'NEGATIVE_STOCK_NOT_ALLOWED'
      );
    }

    await productRepository.updateProductStock(productId, newStock, tx);
    await productRepository.createStockMovement({ product_id: productId, type, quantity }, tx);

    // Produto dispensado da reposição volta para a lista automática quando
    // o estoque é normalizado, para não ficar escondido para sempre.
    if (newStock >= DEFAULT_REPLENISHMENT_THRESHOLD && newStock >= product.minimum_stock) {
      await productRepository.restoreReplenishment(productId, tx);
    }
  });

  return productRepository.findProductById(productId);
}

function registerStockEntry(productId, quantity) {
  return changeStock(productId, quantity, 'ENTRY');
}

function adjustStock(productId, quantity) {
  return changeStock(productId, quantity, 'ADJUSTMENT');
}

async function getLowStockAlert(role) {
  const products = await productRepository.listLowStockProducts();
  return hideCostForList(products, role);
}

async function getExpirationAlert(rawDays, role) {
  const days = rawDays === undefined ? DEFAULT_EXPIRATION_DAYS : Number(rawDays);
  if (!Number.isInteger(days) || days < 0) {
    throw new AppError('Parâmetro days inválido.', 400, 'INVALID_DAYS');
  }

  const limit = new Date();
  limit.setDate(limit.getDate() + days);

  const products = await productRepository.listExpiringProducts(toLocalDate(limit));
  return hideCostForList(products, role);
}

async function getReplenishmentList(role, rawThreshold) {
  const products = await productRepository.listReplenishment(parseThreshold(rawThreshold));
  return hideCostForList(products, role);
}

async function dismissFromReplenishment(rawProductId) {
  const productId = parseId(rawProductId);
  await findProductOrFail(productId);
  await productRepository.dismissReplenishment(productId);
  return { dismissed: true, product_id: productId };
}

async function restoreToReplenishment(rawProductId) {
  const productId = parseId(rawProductId);
  await findProductOrFail(productId);
  await productRepository.restoreReplenishment(productId);
  return { dismissed: false, product_id: productId };
}

/**
 * Gera o PDF da lista de reposição para imprimir e levar ao fornecedor.
 * @returns {Promise<Buffer>}
 */
async function generateReplenishmentPdf(role, rawThreshold) {
  const threshold = parseThreshold(rawThreshold);
  const products = await getReplenishmentList(role, threshold);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Lista de Reposição - Essencial Cosméticos');
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    if (threshold > 0) {
      doc.text(`Inclui produtos com estoque abaixo de ${threshold} unidades.`);
    }
    doc.moveDown();

    if (products.length === 0) {
      doc.fontSize(12).text('Nenhum produto precisa de reposição no momento.');
    }

    for (const product of products) {
      doc
        .fontSize(11)
        .text(
          `${product.name} | Estoque: ${product.stock} | Mínimo: ${product.minimum_stock} | Comprar: ${product.quantity_to_replenish}`
        );
      doc.fontSize(10).text(`Marca: ${product.brand || '-'} | Tamanho: ${product.size || '-'}`);
      doc.moveDown(0.4);
    }

    doc.end();
  });
}

module.exports = {
  createProduct,
  getProductById,
  listProducts,
  updateProduct,
  deleteProduct,
  registerStockEntry,
  adjustStock,
  getLowStockAlert,
  getExpirationAlert,
  getReplenishmentList,
  dismissFromReplenishment,
  restoreToReplenishment,
  generateReplenishmentPdf,
};
