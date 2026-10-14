const AppError = require('../shared/AppError');
const { withTransaction } = require('../config/database');
const { ROLES } = require('../shared/roles');
const { parseId, assertPayload, isValidNumber } = require('../shared/validation');
const { toLocalDate, toLocalDateTime } = require('../shared/dates');
const saleRepository = require('../repositories/saleRepository');
const productRepository = require('../repositories/productRepository');
const reportRepository = require('../repositories/reportRepository');

const PAYMENT_METHODS = {
  DINHEIRO: 'DINHEIRO',
  PIX: 'PIX',
  CARTAO: 'CARTAO',
  PRAZO: 'PRAZO',
};
const VALID_PAYMENTS = Object.values(PAYMENT_METHODS);
const SETTLE_PAYMENTS = [PAYMENT_METHODS.DINHEIRO, PAYMENT_METHODS.PIX, PAYMENT_METHODS.CARTAO];

const MAX_DISCOUNT_PERCENT = 50;

async function assertTodayCashIsOpen() {
  const closure = await reportRepository.findCashClosureByDate(toLocalDate());

  if (closure) {
    throw new AppError(
      'O caixa de hoje já foi fechado. Reabra o caixa para registrar novas vendas.',
      400,
      'CASH_CLOSED'
    );
  }
}

/**
 * Admin acessa qualquer venda; funcionário só as que ele abriu.
 * @param {{userId:number, role:string}} actor
 * @param {{user_id:number}} sale
 */
function assertCanAccessSale(actor, sale) {
  if (actor.role === ROLES.ADMIN || actor.userId === sale.user_id) {
    return;
  }
  throw new AppError('Acesso negado.', 403, 'FORBIDDEN');
}

async function findAccessibleSale(actor, saleId, db) {
  const sale = await saleRepository.findSaleById(saleId, db);
  if (!sale) {
    throw new AppError('Comanda não encontrada.', 404, 'SALE_NOT_FOUND');
  }
  assertCanAccessSale(actor, sale);
  return sale;
}

function assertSaleIsOpen(sale) {
  if (sale.status !== 'OPEN') {
    throw new AppError('Só é possível alterar uma comanda aberta.', 400, 'SALE_NOT_OPEN');
  }
}

function parseDiscount(rawDiscount) {
  if (rawDiscount === undefined || rawDiscount === null || rawDiscount === '') {
    return 0;
  }

  const discount = Number(rawDiscount);
  if (!isValidNumber(rawDiscount) || discount < 0 || discount > MAX_DISCOUNT_PERCENT) {
    throw new AppError(
      `Desconto inválido. Informe um valor entre 0 e ${MAX_DISCOUNT_PERCENT}%.`,
      400,
      'INVALID_DISCOUNT'
    );
  }
  return discount;
}

/**
 * Soma os itens e aplica o desconto, arredondando para centavos.
 * @param {{unit_price:number, quantity:number}[]} items
 * @param {number} discountPercent
 */
function calculateSaleTotal(items, discountPercent) {
  const subtotal = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const total = subtotal * (1 - discountPercent / 100);
  return Number(total.toFixed(2));
}

/**
 * Valida o valor recebido em dinheiro e calcula o troco.
 * Para PIX/cartão não há troco.
 */
function calculateChange(paymentMethod, rawAmountReceived, total) {
  if (paymentMethod !== PAYMENT_METHODS.DINHEIRO) {
    return { amountReceived: null, changeAmount: 0 };
  }

  if (!isValidNumber(rawAmountReceived)) {
    throw new AppError(
      'Informe o valor recebido para pagamento em dinheiro.',
      400,
      'AMOUNT_RECEIVED_REQUIRED'
    );
  }

  const amountReceived = Number(rawAmountReceived);
  if (amountReceived < total) {
    throw new AppError('Valor recebido é menor que o total da venda.', 400, 'INSUFFICIENT_AMOUNT_RECEIVED');
  }

  return {
    amountReceived,
    changeAmount: Number((amountReceived - total).toFixed(2)),
  };
}

async function refreshSaleTotal(sale) {
  const items = await saleRepository.listSaleItems(sale.id);
  const total = calculateSaleTotal(items, Number(sale.discount_percent || 0));
  await saleRepository.updateSaleTotal(sale.id, total);
}

/**
 * Abre uma nova comanda.
 * @param {{userId:number, role:string}} actor
 * @param {{client_name?:string}} payload
 */
async function createSale(actor, payload) {
  assertPayload(payload);
  await assertTodayCashIsOpen();

  const clientName = String(payload.client_name || '').trim();
  if (!clientName) {
    throw new AppError('Informe o nome do cliente para abrir a comanda.', 400, 'CLIENT_NAME_REQUIRED');
  }

  return saleRepository.createSale({ user_id: actor.userId, client_name: clientName });
}

async function getSaleById(actor, saleId) {
  const sale = await findAccessibleSale(actor, parseId(saleId));
  const items = await saleRepository.listSaleItems(sale.id);

  return {
    ...sale,
    pending_receipt:
      sale.status === 'FINALIZED' && sale.payment_method === PAYMENT_METHODS.PRAZO && !sale.settled_at,
    items,
  };
}

/**
 * Adiciona um produto na comanda. O estoque só é baixado na finalização,
 * então aqui não validamos saldo (o frontend já mostra o disponível).
 */
async function addSaleItem(actor, saleId, payload) {
  assertPayload(payload);
  const productId = parseId(payload.product_id);
  const quantity = Number(payload.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('Quantidade inválida.', 400, 'INVALID_QUANTITY');
  }

  const sale = await findAccessibleSale(actor, parseId(saleId));
  assertSaleIsOpen(sale);

  const product = await productRepository.findProductById(productId);
  if (!product) {
    throw new AppError('Produto não encontrado.', 404, 'PRODUCT_NOT_FOUND');
  }

  await saleRepository.createSaleItem({
    sale_id: sale.id,
    product_id: productId,
    quantity,
    unit_price: Number(product.sale_price),
    purchase_price_snapshot: Number(product.purchase_price),
  });
  await refreshSaleTotal(sale);

  return getSaleById(actor, sale.id);
}

async function removeSaleItem(actor, saleId, itemId) {
  const sale = await findAccessibleSale(actor, parseId(saleId));
  assertSaleIsOpen(sale);

  const item = await saleRepository.findSaleItemById(parseId(itemId));
  if (!item || item.sale_id !== sale.id) {
    throw new AppError('Item da comanda não encontrado.', 404, 'SALE_ITEM_NOT_FOUND');
  }

  await saleRepository.deleteSaleItem(item.id);
  await refreshSaleTotal(sale);

  return getSaleById(actor, sale.id);
}

/**
 * Finaliza a comanda e baixa o estoque de todos os itens.
 *
 * - Desconto máximo de 50%.
 * - DINHEIRO exige valor recebido e calcula o troco.
 * - PRAZO baixa o estoque agora, mas só entra no caixa quando for quitada
 *   (settled_at fica nulo até lá).
 *
 * Tudo roda em uma transação: se faltar estoque de um item, nenhum
 * produto é baixado e a comanda continua aberta.
 */
async function finalizeSale(actor, saleId, payload) {
  assertPayload(payload);
  const parsedSaleId = parseId(saleId);

  const paymentMethod = payload.payment_method;
  if (!VALID_PAYMENTS.includes(paymentMethod)) {
    throw new AppError('Forma de pagamento inválida.', 400, 'INVALID_PAYMENT_METHOD');
  }
  const discountPercent = parseDiscount(payload.discount_percent);

  await assertTodayCashIsOpen();

  await withTransaction(async (tx) => {
    const sale = await findAccessibleSale(actor, parsedSaleId, tx);
    assertSaleIsOpen(sale);

    const items = await saleRepository.listSaleItems(sale.id, tx);
    if (items.length === 0) {
      throw new AppError('Adicione ao menos um item antes de finalizar.', 400, 'EMPTY_SALE');
    }

    const total = calculateSaleTotal(items, discountPercent);
    const { amountReceived, changeAmount } = calculateChange(paymentMethod, payload.amount_received, total);

    for (const item of items) {
      // Lê o produto de novo a cada item: se o mesmo produto aparece duas
      // vezes na comanda, a segunda leitura já enxerga o estoque baixado.
      const product = await productRepository.findProductById(item.product_id, tx);

      if (product.stock < item.quantity) {
        throw new AppError(
          `Estoque insuficiente para ${product.name} (disponível: ${product.stock}).`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      await productRepository.updateProductStock(product.id, product.stock - item.quantity, tx);
      await productRepository.createStockMovement(
        { product_id: product.id, type: 'SALE', quantity: -item.quantity, reference_id: sale.id },
        tx
      );
    }

    await saleRepository.finalizeSale(
      {
        saleId: sale.id,
        paymentMethod,
        total,
        discountPercent,
        amountReceived,
        changeAmount,
        settledAt: paymentMethod === PAYMENT_METHODS.PRAZO ? null : toLocalDateTime(),
      },
      tx
    );
  });

  return getSaleById(actor, parsedSaleId);
}

async function cancelSale(actor, saleId) {
  const sale = await findAccessibleSale(actor, parseId(saleId));

  if (sale.status !== 'OPEN') {
    throw new AppError('Apenas comandas abertas podem ser canceladas.', 400, 'SALE_NOT_OPEN');
  }

  return saleRepository.cancelSale(sale.id);
}

/**
 * Permite retomar uma comanda que ficou aberta (ex: a página foi recarregada).
 */
async function listOpenSales(actor) {
  const options = actor.role === ROLES.FUNCIONARIO ? { userId: actor.userId } : {};
  return saleRepository.listOpenSales(options);
}

async function listPendingSales(actor) {
  const options = actor.role === ROLES.FUNCIONARIO ? { userId: actor.userId } : {};
  return saleRepository.listPendingSales(options);
}

/**
 * Registra o pagamento de uma venda a prazo. Não mexe no estoque, que já foi
 * baixado na finalização.
 */
async function settlePendingSale(actor, saleId, payload) {
  assertPayload(payload);
  await assertTodayCashIsOpen();

  const sale = await findAccessibleSale(actor, parseId(saleId));

  const isPending =
    sale.status === 'FINALIZED' && sale.payment_method === PAYMENT_METHODS.PRAZO && !sale.settled_at;
  if (!isPending) {
    throw new AppError('Esta comanda não está pendente de pagamento.', 400, 'SALE_NOT_PENDING');
  }

  const paymentMethod = payload.payment_method || PAYMENT_METHODS.DINHEIRO;
  if (!SETTLE_PAYMENTS.includes(paymentMethod)) {
    throw new AppError('Forma de pagamento inválida para quitação.', 400, 'INVALID_PAYMENT_METHOD');
  }

  const { amountReceived, changeAmount } = calculateChange(
    paymentMethod,
    payload.amount_received,
    Number(sale.total)
  );

  const { changes } = await saleRepository.settlePendingSale({
    saleId: sale.id,
    paymentMethod,
    amountReceived,
    changeAmount,
    settledAt: toLocalDateTime(),
  });

  if (changes === 0) {
    throw new AppError('Esta comanda já foi quitada.', 409, 'SALE_ALREADY_SETTLED');
  }

  return getSaleById(actor, sale.id);
}

/**
 * Histórico de vendas finalizadas. O filtro do funcionário vai na query
 * (e não num .filter() depois) para a paginação contar só as vendas dele.
 * @param {{userId:number, role:string}} actor
 * @param {{limit:number, offset:number}|null} pagination
 */
async function listFinalizedSalesHistory(actor, pagination) {
  const options = actor.role === ROLES.FUNCIONARIO ? { userId: actor.userId } : {};

  if (!pagination) {
    return saleRepository.listFinalizedSalesHistory(options);
  }

  const [sales, total] = await Promise.all([
    saleRepository.listFinalizedSalesHistory({ ...options, ...pagination }),
    saleRepository.countFinalizedSalesHistory(options),
  ]);

  return { data: sales, total };
}

module.exports = {
  createSale,
  getSaleById,
  addSaleItem,
  removeSaleItem,
  finalizeSale,
  cancelSale,
  listOpenSales,
  listPendingSales,
  settlePendingSale,
  listFinalizedSalesHistory,
};
