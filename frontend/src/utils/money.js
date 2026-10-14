const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

// Máscara dos campos de valor: o usuário digita só números e o campo
// mostra "R$ 12,34" (os dois últimos dígitos são os centavos).
export function formatMoneyInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return formatMoney(Number(digits) / 100);
}

// Preenche o campo com um valor que veio da API (ex: 10.5 -> "R$ 10,50").
// Não usar formatMoneyInput aqui: ele trataria 10 como 10 centavos.
export function toMoneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return formatMoney(value);
}

// Converte o texto da máscara de volta para número (NaN se estiver vazio).
export function parseMoneyInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return NaN;
  return Number(digits) / 100;
}
