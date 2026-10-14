const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Interpreta parâmetros de paginação vindos da query string.
 *
 * Retorna null quando nem `page` nem `limit` foram enviados, para manter o
 * comportamento antigo (array completo) nos endpoints que ainda não passam
 * esses parâmetros — evita quebrar consumidores existentes.
 *
 * @param {{ page?: string, limit?: string }} query
 * @returns {{ page: number, limit: number, offset: number } | null}
 */
function parsePagination(query) {
  if (!query || (query.page === undefined && query.limit === undefined)) {
    return null;
  }

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawLimit = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Monta o envelope de resposta paginada padrão da API.
 *
 * @param {Array} data
 * @param {number} total
 * @param {{ page: number, limit: number }} pagination
 */
function buildPaginatedResponse(data, total, { page, limit }) {
  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = {
  parsePagination,
  buildPaginatedResponse,
};
