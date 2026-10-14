// A API usa códigos fixos (DINHEIRO, OPEN...). Aqui ficam os textos de tela.

export const PAYMENT_LABELS = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO: "Cartão",
  PRAZO: "A prazo",
};

export const SALE_STATUS_LABELS = {
  OPEN: "Aberta",
  FINALIZED: "Finalizada",
  CANCELED: "Cancelada",
};

export function formatPaymentMethod(method) {
  return PAYMENT_LABELS[method] || method || "Outros";
}

export function formatSaleStatus(status) {
  return SALE_STATUS_LABELS[status] || status;
}
