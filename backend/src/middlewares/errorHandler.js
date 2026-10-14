const AppError = require('../shared/AppError');

// Precisa ter os 4 parâmetros para o Express reconhecer como handler de erro.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  // JSON mal formatado no body (erro lançado pelo express.json()).
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido.', code: 'INVALID_JSON' });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({ error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' });
}

module.exports = errorHandler;
