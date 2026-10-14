/**
 * Erro esperado da aplicação (validação, permissão, regra de negócio).
 * O errorHandler devolve `message` e `code` para o frontend com o status
 * informado. Qualquer outro erro vira 500.
 */
class AppError extends Error {
  /**
   * @param {string} message mensagem que aparece para o usuário
   * @param {number} [statusCode=400]
   * @param {string} [code='APP_ERROR'] código fixo para o frontend tratar casos específicos
   */
  constructor(message, statusCode = 400, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
