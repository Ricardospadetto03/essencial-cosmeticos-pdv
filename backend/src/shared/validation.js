const AppError = require('./AppError');

/**
 * Converte o id recebido (geralmente de req.params) em inteiro positivo.
 * @param {number|string} rawId
 * @returns {number}
 */
function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('ID inválido.', 400, 'INVALID_ID');
  }
  return id;
}

/**
 * Garante que o corpo da requisição é um objeto JSON (e não array/null).
 * @param {unknown} payload
 */
function assertPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError('Payload inválido.', 400, 'INVALID_PAYLOAD');
  }
}

/**
 * Verifica se o valor é um número finito (rejeita '', 'abc', null, NaN).
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidNumber(value) {
  if (value === null || value === '' || typeof value === 'boolean') {
    return false;
  }
  return Number.isFinite(Number(value));
}

module.exports = {
  parseId,
  assertPayload,
  isValidNumber,
};
