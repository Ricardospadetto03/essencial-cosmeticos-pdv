const productService = require('../services/productService');
const { toLocalDate } = require('../shared/dates');

// Permissões (quem pode criar/editar/excluir) ficam em routes/productRoutes.js.

async function createProduct(req, res, next) {
  try {
    const result = await productService.createProduct(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function listProducts(req, res, next) {
  try {
    const products = await productService.listProducts(req.query, req.user.role);
    return res.json(products);
  } catch (error) {
    return next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id, req.user.role);
    return res.json(product);
  } catch (error) {
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return res.json(product);
  } catch (error) {
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const result = await productService.deleteProduct(req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function registerStockEntry(req, res, next) {
  try {
    const product = await productService.registerStockEntry(req.params.id, req.body?.quantity);
    return res.json(product);
  } catch (error) {
    return next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const product = await productService.adjustStock(req.params.id, req.body?.quantity);
    return res.json(product);
  } catch (error) {
    return next(error);
  }
}

async function lowStockAlert(req, res, next) {
  try {
    const products = await productService.getLowStockAlert(req.user.role);
    return res.json(products);
  } catch (error) {
    return next(error);
  }
}

async function expirationAlert(req, res, next) {
  try {
    const products = await productService.getExpirationAlert(req.query.days, req.user.role);
    return res.json(products);
  } catch (error) {
    return next(error);
  }
}

async function replenishmentList(req, res, next) {
  try {
    const products = await productService.getReplenishmentList(req.user.role, req.query.threshold);
    return res.json(products);
  } catch (error) {
    return next(error);
  }
}

async function dismissReplenishmentItem(req, res, next) {
  try {
    const result = await productService.dismissFromReplenishment(req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function restoreReplenishmentItem(req, res, next) {
  try {
    const result = await productService.restoreToReplenishment(req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function exportReplenishmentPdf(req, res, next) {
  try {
    const pdfBuffer = await productService.generateReplenishmentPdf(req.user.role, req.query.threshold);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lista-reposicao-${toLocalDate()}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  registerStockEntry,
  adjustStock,
  lowStockAlert,
  expirationAlert,
  replenishmentList,
  dismissReplenishmentItem,
  restoreReplenishmentItem,
  exportReplenishmentPdf,
};
