const saleService = require('../services/saleService');
const { parsePagination, buildPaginatedResponse } = require('../shared/pagination');

// O service usa o "actor" (quem está fazendo a operação) para aplicar a regra
// de que funcionário só mexe nas próprias vendas.
function getActor(req) {
  return { userId: req.user.id, role: req.user.role };
}

async function createSale(req, res, next) {
  try {
    const result = await saleService.createSale(getActor(req), req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getSaleById(req, res, next) {
  try {
    const sale = await saleService.getSaleById(getActor(req), req.params.id);
    return res.json(sale);
  } catch (error) {
    return next(error);
  }
}

async function addSaleItem(req, res, next) {
  try {
    const sale = await saleService.addSaleItem(getActor(req), req.params.id, req.body);
    return res.json(sale);
  } catch (error) {
    return next(error);
  }
}

async function removeSaleItem(req, res, next) {
  try {
    const sale = await saleService.removeSaleItem(getActor(req), req.params.id, req.params.itemId);
    return res.json(sale);
  } catch (error) {
    return next(error);
  }
}

async function finalizeSale(req, res, next) {
  try {
    const sale = await saleService.finalizeSale(getActor(req), req.params.id, req.body);
    return res.json(sale);
  } catch (error) {
    return next(error);
  }
}

async function cancelSale(req, res, next) {
  try {
    const result = await saleService.cancelSale(getActor(req), req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listOpenSales(req, res, next) {
  try {
    const sales = await saleService.listOpenSales(getActor(req));
    return res.json(sales);
  } catch (error) {
    return next(error);
  }
}

async function listPendingSales(req, res, next) {
  try {
    const sales = await saleService.listPendingSales(getActor(req));
    return res.json(sales);
  } catch (error) {
    return next(error);
  }
}

async function settlePendingSale(req, res, next) {
  try {
    const sale = await saleService.settlePendingSale(getActor(req), req.params.id, req.body);
    return res.json(sale);
  } catch (error) {
    return next(error);
  }
}

async function listFinalizedSalesHistory(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const result = await saleService.listFinalizedSalesHistory(getActor(req), pagination);

    if (pagination) {
      return res.json(buildPaginatedResponse(result.data, result.total, pagination));
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
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
