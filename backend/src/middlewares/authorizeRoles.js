const AppError = require('../shared/AppError');

/**
 * Libera a rota apenas para os perfis informados.
 * Deve vir depois do `authenticate`, que preenche req.user.
 *
 * Exemplo: router.delete('/users/:id', authenticate, authorizeRoles('ADMIN'), ...)
 *
 * @param {...string} roles
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Não autenticado.', 401, 'NOT_AUTHENTICATED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Acesso negado.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = authorizeRoles;
