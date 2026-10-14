const jwt = require('jsonwebtoken');
const AppError = require('../shared/AppError');

/**
 * Lê o token "Bearer <token>" do header Authorization e coloca o usuário
 * em req.user ({ id, role }) para as próximas camadas.
 */
function authenticate(req, res, next) {
  const authorizationHeader = req.headers.authorization || '';
  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Token não fornecido.', 401, 'TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch (error) {
    return next(new AppError('Sessão expirada. Faça login novamente.', 401, 'INVALID_TOKEN'));
  }
}

module.exports = authenticate;
