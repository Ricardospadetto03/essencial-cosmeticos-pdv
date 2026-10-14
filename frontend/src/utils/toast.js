// O ToastHost (montado no App) escuta esse evento e mostra a mensagem.
// Usar um evento do window evita ter que passar contexto para todas as telas.
export function showToast(message, type = "info") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, type } }));
}
