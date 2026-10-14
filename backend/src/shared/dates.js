// O caixa trabalha com o horário local da loja. Usar toISOString() (UTC)
// faria uma venda feita às 22h no Brasil cair no dia seguinte.

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD
 */
function toLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD HH:mm:ss (formato que o SQLite entende)
 */
function toLocalDateTime(date = new Date()) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${toLocalDate(date)} ${time}`;
}

module.exports = {
  toLocalDate,
  toLocalDateTime,
};
