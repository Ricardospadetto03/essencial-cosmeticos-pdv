const authService = require('../services/authService');

/**
 * Controller de autenticação.
 *
 * Responsabilidade:
 * - Receber dados HTTP da requisição.
 * - Delegar regra de negócio para o authService.
 * - Encaminhar erros para o middleware global (next).
 */
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
};
