// Data de hoje no fuso local, no formato YYYY-MM-DD usado pela API.
export function getTodayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Faz parse seguro de datas comuns da API (YYYY-MM-DD e YYYY-MM-DD HH:mm:ss).
function parseApiDate(rawValue) {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value) return null;

  // Data simples sem horário.
  const onlyDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (onlyDateMatch) {
    const [, year, month, day] = onlyDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  // Data com horário sem timezone explícito.
  const localDateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDateTimeMatch) {
    const [, year, month, day, hours, minutes, seconds = "0"] = localDateTimeMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
  }

  // Fallback para formatos ISO completos.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Formata data no padrão brasileiro (dd/mm/aaaa).
export function formatDateBR(rawValue, fallback = "-") {
  const parsed = parseApiDate(rawValue);
  if (!parsed) return fallback;
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

// Formata data e hora no padrão brasileiro (dd/mm/aaaa HH:mm).
export function formatDateTimeBR(rawValue, fallback = "-") {
  const parsed = parseApiDate(rawValue);
  if (!parsed) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
