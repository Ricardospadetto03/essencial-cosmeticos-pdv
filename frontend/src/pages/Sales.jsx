import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import CardMenu from "../components/CardMenu";
import { formatDateBR, formatDateTimeBR, getTodayIsoDate } from "../utils/dateFormat";
import { useAuth } from "../hooks/useAuth";
import { showToast } from "../utils/toast";
import PaginationControls from "../components/PaginationControls";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../utils/money";
import { PAYMENT_LABELS, formatPaymentMethod, formatSaleStatus } from "../utils/labels";

const PAYMENT_OPTIONS = ["DINHEIRO", "PIX", "CARTAO", "PRAZO"];
const HISTORY_PAGE_SIZE = 20;
const SALES_HOME = "HOME";
const SALES_COMANDA = "COMANDA";
const SALES_PENDING = "PENDENTES";
const SALES_PENDING_DETAIL = "PENDENTE_DETALHE";
const SALES_HISTORY = "HISTORICO";
const SALES_CASH_CLOSE_MENU = "FECHAMENTO_CAIXA_MENU";
const SALES_CASH_CLOSE = "FECHAMENTO_CAIXA";
const SALES_CASH_REOPEN = "REABRIR_CAIXA";

function Sales() {
  const { isAdmin } = useAuth();

  const [activeView, setActiveView] = useState(SALES_HOME);

  const [products, setProducts] = useState([]);
  const [sale, setSale] = useState(null);
  const [clientName, setClientName] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [amountReceived, setAmountReceived] = useState("");

  const [openSales, setOpenSales] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [pendingSalesDetails, setPendingSalesDetails] = useState({});
  const [selectedPendingId, setSelectedPendingId] = useState(null);
  const [historySales, setHistorySales] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [cashCloseDate, setCashCloseDate] = useState(getTodayIsoDate());
  const [cashCloseSummary, setCashCloseSummary] = useState(null);
  const [cashCloseStatus, setCashCloseStatus] = useState(null);
  const [cashCloseLoading, setCashCloseLoading] = useState(false);
  const [settleMethodBySale, setSettleMethodBySale] = useState({});
  const [settleAmountBySale, setSettleAmountBySale] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    if (!sale?.items?.length) return 0;
    return sale.items.reduce(
      (acc, item) => acc + Number(item.unit_price || 0) * Number(item.quantity || 0),
      0
    );
  }, [sale]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      String(product.name || "")
        .toLowerCase()
        .includes(term)
    );
  }, [products, productSearch]);

  const productSuggestions = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === String(productId)) || null,
    [products, productId]
  );
  const selectedProductStock = Number(selectedProduct?.stock ?? 0);
  const reservedByProductId = useMemo(() => {
    const reserved = {};
    (sale?.items || []).forEach((item) => {
      const key = String(item.product_id);
      reserved[key] = Number(reserved[key] || 0) + Number(item.quantity || 0);
    });
    return reserved;
  }, [sale]);
  const selectedProductAvailableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const reserved = Number(reservedByProductId[String(selectedProduct.id)] || 0);
    return Math.max(0, selectedProductStock - reserved);
  }, [selectedProduct, selectedProductStock, reservedByProductId]);

  const totalWithDiscount = useMemo(() => {
    const discount = Number(discountPercent || 0);
    const safeDiscount = Number.isFinite(discount) ? Math.min(50, Math.max(0, discount)) : 0;
    return Number((subtotal - subtotal * (safeDiscount / 100)).toFixed(2));
  }, [subtotal, discountPercent]);

  const estimatedChange = useMemo(() => {
    if (paymentMethod !== "DINHEIRO") return 0;
    const received = parseMoneyInput(amountReceived);
    if (!Number.isFinite(received)) return 0;
    return Number((received - totalWithDiscount).toFixed(2));
  }, [paymentMethod, amountReceived, totalWithDiscount]);
  const selectedPendingSale = useMemo(
    () => pendingSales.find((pending) => pending.id === selectedPendingId) || null,
    [pendingSales, selectedPendingId]
  );

  async function loadData() {
    setLoading(true);
    try {
      const [productsResponse, openResponse, pendingResponse, historyResponse] = await Promise.all([
        api.get("/products"),
        api.get("/sales/open/list"),
        api.get("/sales/pending/list"),
        api.get("/sales/history/finalized", {
          params: { page: 1, limit: HISTORY_PAGE_SIZE },
        }),
      ]);

      // Carrega itens de cada pendência para exibir resumo da compra na própria listagem.
      const pendingDetailsPairs = await Promise.all(
        (pendingResponse.data || []).map(async (pendingSale) => {
          try {
            const detailResponse = await api.get(`/sales/${pendingSale.id}`);
            return [pendingSale.id, detailResponse.data];
          } catch {
            return [pendingSale.id, null];
          }
        })
      );
      const nextPendingDetails = Object.fromEntries(pendingDetailsPairs);

      setProducts(productsResponse.data);
      setOpenSales(openResponse.data);
      setPendingSales(pendingResponse.data);
      setPendingSalesDetails(nextPendingDetails);
      setHistorySales(historyResponse.data.data);
      setHistoryPage(historyResponse.data.page);
      setHistoryTotalPages(historyResponse.data.totalPages);
      // Se a pendência aberta não existir mais, fecha o detalhe automaticamente.
      if (
        selectedPendingId &&
        !(pendingResponse.data || []).some((pendingSale) => pendingSale.id === selectedPendingId)
      ) {
        setSelectedPendingId(null);
        if (activeView === SALES_PENDING_DETAIL) {
          setActiveView(SALES_PENDING);
        }
      }
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao carregar dados de vendas.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryPage(targetPage) {
    setLoading(true);
    try {
      const { data } = await api.get("/sales/history/finalized", {
        params: { page: targetPage, limit: HISTORY_PAGE_SIZE },
      });
      setHistorySales(data.data);
      setHistoryPage(data.page);
      setHistoryTotalPages(data.totalPages);
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao carregar histórico de vendas.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCashCloseData() {
    const dateValue = getTodayIsoDate();
    setCashCloseDate(dateValue);
    setCashCloseLoading(true);
    try {
      const [summaryResponse, statusResponse] = await Promise.all([
        api.get(`/cash/summary/daily?date=${encodeURIComponent(dateValue)}`),
        api.get(`/cash/closure?date=${encodeURIComponent(dateValue)}`),
      ]);

      setCashCloseSummary(summaryResponse.data);
      setCashCloseStatus(statusResponse.data);
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao carregar fechamento de caixa.", "error");
    } finally {
      setCashCloseLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSale() {
    if (!sale?.id) return;
    const { data } = await api.get(`/sales/${sale.id}`);
    setSale(data);
    setDiscountPercent(String(data?.discount_percent ?? 0));
  }

  async function handleCreateSale(event) {
    event.preventDefault();
    const normalizedName = clientName.trim();
    if (!normalizedName) {
      showToast("Nome do cliente é obrigatório para abrir comanda.", "error");
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post("/sales", { client_name: normalizedName });
      const saleResponse = await api.get(`/sales/${data.id}`);
      setSale(saleResponse.data);
      setClientName("");
      setDiscountPercent(String(saleResponse.data?.discount_percent ?? 0));
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao abrir comanda.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(event) {
    event.preventDefault();
    if (!sale?.id) return;
    if (!productId) {
      showToast("Selecione um produto da lista sugerida.", "error");
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      showToast("Informe uma quantidade válida.", "error");
      return;
    }

    if (selectedProduct && parsedQuantity > selectedProductAvailableStock) {
      showToast(`Quantidade indisponível. Em estoque: ${selectedProductAvailableStock}.`, "error");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/sales/${sale.id}/items`, {
        product_id: Number(productId),
        quantity: parsedQuantity,
      });
      setProductId("");
      setProductSearch("");
      setShowProductSuggestions(false);
      setQuantity("1");
      await refreshSale();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao adicionar item.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleProductSearchChange(nextValue) {
    setProductSearch(nextValue);
    setShowProductSuggestions(true);

    const normalized = nextValue.trim().toLowerCase();
    const exactMatch = products.find((product) => String(product.name || "").toLowerCase() === normalized);
    setProductId(exactMatch ? String(exactMatch.id) : "");
  }

  function handleSelectSuggestedProduct(product) {
    setProductSearch(product.name);
    setProductId(String(product.id));
    setShowProductSuggestions(false);
  }

  async function handleRemoveItem(itemId) {
    if (!sale?.id) return;
    setSaving(true);
    try {
      await api.delete(`/sales/${sale.id}/items/${itemId}`);
      await refreshSale();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao remover item.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalizeSale(event) {
    event.preventDefault();
    if (!sale?.id) return;

    setSaving(true);
    try {
      const payload = {
        payment_method: paymentMethod,
        discount_percent: Number(discountPercent || 0),
      };

      if (paymentMethod === "DINHEIRO") {
        const received = parseMoneyInput(amountReceived);
        if (!Number.isFinite(received)) {
          showToast("Informe um valor recebido válido.", "error");
          setSaving(false);
          return;
        }
        if (received < totalWithDiscount) {
          showToast("Valor recebido menor que o total da comanda.", "error");
          setSaving(false);
          return;
        }
        payload.amount_received = received;
      }

      const { data } = await api.post(`/sales/${sale.id}/finalize`, payload);
      setSale(data);
      setAmountReceived("");
      showToast(`Comanda #${sale.id} finalizada.`, "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao finalizar comanda.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleResumeSale(saleId) {
    setSaving(true);
    try {
      const { data } = await api.get(`/sales/${saleId}`);
      setSale(data);
      setDiscountPercent(String(data.discount_percent ?? 0));
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao abrir comanda.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSale() {
    if (!sale?.id) return;
    if (!window.confirm(`Cancelar a comanda #${sale.id}? Os itens adicionados serão descartados.`)) return;
    setSaving(true);
    try {
      await api.post(`/sales/${sale.id}/cancel`);
      showToast(`Comanda #${sale.id} cancelada.`, "success");
      setSale(null);
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao cancelar comanda.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSettlePendingSale(targetSaleId, settleMethod, settleAmount) {
    setSaving(true);
    try {
      const payload = { payment_method: settleMethod };
      if (settleMethod === "DINHEIRO") {
        const received = parseMoneyInput(settleAmount);
        const pendingSale = pendingSales.find((saleItem) => saleItem.id === targetSaleId);
        const pendingTotal = Number(pendingSale?.total || 0);

        if (!Number.isFinite(received)) {
          showToast("Informe um valor recebido válido para quitação em dinheiro.", "error");
          setSaving(false);
          return;
        }

        if (received < pendingTotal) {
          showToast(`Valor recebido menor que o total (${formatMoney(pendingTotal)}).`, "error");
          setSaving(false);
          return;
        }

        payload.amount_received = received;
      }
      await api.post(`/sales/${targetSaleId}/settle`, payload);
      showToast(`Comanda #${targetSaleId} quitada.`, "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao quitar pendência.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseCashDay() {
    setSaving(true);
    try {
      const { data } = await api.post("/cash/close", {});
      showToast(`Caixa de ${formatDateBR(data.date)} fechado com sucesso.`, "success");
      await loadCashCloseData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao fechar caixa do dia.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReopenCashDay() {
    setSaving(true);
    try {
      const { data } = await api.post("/cash/reopen", {});
      showToast(`Caixa de ${formatDateBR(data.date)} reaberto com sucesso.`, "success");
      await loadCashCloseData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao reabrir caixa do dia.", "error");
    } finally {
      setSaving(false);
    }
  }

  function renderOpenSalesList() {
    if (!openSales.length) return null;

    return (
      <div className="section-card">
        <h3>Comandas em aberto</h3>
        <p className="muted">Comandas iniciadas e ainda não finalizadas. Continue de onde parou.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Total parcial</th>
                <th>Aberta em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {openSales.map((openSale) => (
                <tr key={openSale.id}>
                  <td>{openSale.id}</td>
                  <td>{openSale.client_name || "-"}</td>
                  <td>{formatMoney(openSale.total)}</td>
                  <td>{formatDateTimeBR(openSale.created_at)}</td>
                  <td>
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => handleResumeSale(openSale.id)}
                      disabled={saving}
                    >
                      Continuar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderComandaTab() {
    const isOpen = sale?.status === "OPEN";

    return (
      <div className="section-stack">
        {!isOpen ? (
          <form className="section-card comanda-create-card comanda-create-grid" onSubmit={handleCreateSale}>
            <button
              className="back-arrow-btn"
              type="button"
              onClick={() => setActiveView(SALES_HOME)}
              aria-label="Voltar ao menu"
            >
              ←
            </button>
            <h3>Abrir Comanda</h3>
            <label>
              Nome do cliente
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Digite o nome do cliente"
                required
              />
            </label>
            <button className="btn-primary" type="submit" disabled={saving || !clientName.trim()}>
              Abrir comanda
            </button>
          </form>
        ) : null}

        {!isOpen ? renderOpenSalesList() : null}

        {sale ? (
          <div className="section-card comanda-main-card">
            <div className="inline-row">
              <button
                className="back-arrow-btn"
                type="button"
                onClick={() => setActiveView(SALES_HOME)}
                aria-label="Voltar ao menu"
              >
                ←
              </button>
            </div>
            <div className="comanda-header">
              <h3>Comanda Atual #{sale.id}</h3>
              <span className={isOpen ? "comanda-status is-open" : "comanda-status"}>
                {formatSaleStatus(sale.status)}
              </span>
            </div>
            <p className="muted">Cliente: {sale.client_name || "-"}</p>

            {isOpen ? (
              <>
                <form className="comanda-subcard add-item-form" onSubmit={handleAddItem}>
                  <div className="add-item-grid">
                    <h4 className="add-item-title">Adicionar Item</h4>
                    <div className="add-item-product-col">
                      <label className="autocomplete-wrap">
                        Produto
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(event) => handleProductSearchChange(event.target.value)}
                          onFocus={() => setShowProductSuggestions(true)}
                          onBlur={() => {
                            setTimeout(() => setShowProductSuggestions(false), 120);
                          }}
                          placeholder="Digite o nome do produto"
                          autoComplete="off"
                          required
                        />
                        {showProductSuggestions ? (
                          <div className="autocomplete-list">
                            {productSuggestions.length ? (
                              productSuggestions.map((product) => {
                                const reserved = Number(reservedByProductId[String(product.id)] || 0);
                                const available = Math.max(0, Number(product.stock) - reserved);
                                return (
                                  <button
                                    type="button"
                                    key={product.id}
                                    className="autocomplete-item"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSelectSuggestedProduct(product)}
                                  >
                                    #{product.id} - {product.name}
                                    <span>
                                      {formatMoney(product.sale_price)} | Est.: {available}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <p className="autocomplete-empty">Nenhum produto encontrado.</p>
                            )}
                          </div>
                        ) : null}
                      </label>
                    </div>
                    <label className="add-item-qty-col">
                      Quantidade
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        required
                      />
                    </label>
                    <div className="add-item-action">
                      <button
                        className="btn-primary add-item-btn"
                        type="submit"
                        disabled={
                          saving || !selectedProduct || Number(quantity || 0) > selectedProductAvailableStock
                        }
                      >
                        Adicionar item
                      </button>
                    </div>
                  </div>
                  {selectedProduct ? (
                    <small className="stock-hint stock-hint-row">
                      Em estoque: {selectedProductAvailableStock}
                    </small>
                  ) : (
                    <small className="stock-hint stock-hint-row">
                      Selecione um produto para ver o estoque disponível.
                    </small>
                  )}
                </form>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Unitário</th>
                        <th>Total</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items?.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.product_name}</td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.unit_price)}</td>
                          <td>{formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
                          <td>
                            <button
                              className="btn-danger"
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={saving}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form className="inline-form comanda-subcard" onSubmit={handleFinalizeSale}>
                  <h4>Finalização</h4>
                  <div className="sale-summary-metrics">
                    <div className="sale-metric-card">
                      <span>Subtotal</span>
                      <strong>{formatMoney(subtotal)}</strong>
                    </div>
                    <div className="sale-metric-card is-highlight">
                      <span>Total com desconto</span>
                      <strong>{formatMoney(totalWithDiscount)}</strong>
                    </div>
                  </div>
                  <label>
                    Desconto (%)
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={discountPercent}
                      onChange={(event) => setDiscountPercent(event.target.value)}
                    />
                  </label>
                  <label>
                    Pagamento
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      {PAYMENT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {PAYMENT_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {paymentMethod === "DINHEIRO" ? (
                    <>
                      <label>
                        Valor recebido
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="R$ 0,00"
                          value={amountReceived}
                          onChange={(event) => setAmountReceived(formatMoneyInput(event.target.value))}
                          required
                        />
                      </label>
                      <label>
                        Troco estimado
                        <input type="text" value={formatMoney(Math.max(0, estimatedChange))} readOnly />
                      </label>
                    </>
                  ) : null}
                  <div className="inline-row">
                    <button className="btn-primary" type="submit" disabled={saving}>
                      Finalizar comanda
                    </button>
                    <button className="btn-danger" type="button" onClick={handleCancelSale} disabled={saving}>
                      Cancelar comanda
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="state-message">Comanda encerrada. Abra uma nova para continuar.</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPendingTab() {
    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={() => setActiveView(SALES_HOME)}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Vendas Pendentes (Prazo)</h3>
        <p className="muted">Vendas já finalizadas e aguardando quitação.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Criada em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingSales.map((pending) => {
                return (
                  <tr key={pending.id}>
                    <td>{pending.id}</td>
                    <td>{pending.client_name || "-"}</td>
                    <td>{formatMoney(pending.total)}</td>
                    <td>{formatDateTimeBR(pending.created_at)}</td>
                    <td>
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => {
                          setSelectedPendingId(pending.id);
                          setActiveView(SALES_PENDING_DETAIL);
                        }}
                      >
                        Abrir comanda
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPendingDetailTab() {
    if (!selectedPendingSale) {
      return (
        <div className="section-card">
          <div className="inline-row">
            <button
              className="back-arrow-btn"
              type="button"
              onClick={() => setActiveView(SALES_PENDING)}
              aria-label="Voltar para pendências"
            >
              ←
            </button>
          </div>
          <p className="state-message">Comanda pendente não encontrada.</p>
        </div>
      );
    }

    const settleMethod = settleMethodBySale[selectedPendingSale.id] || "DINHEIRO";
    const settleAmount = settleAmountBySale[selectedPendingSale.id] || "";
    const selectedPendingTotal = Number(selectedPendingSale.total || 0);
    const selectedReceived = parseMoneyInput(settleAmount);
    const selectedPendingChange =
      settleMethod === "DINHEIRO" && Number.isFinite(selectedReceived)
        ? Math.max(0, Number((selectedReceived - selectedPendingTotal).toFixed(2)))
        : 0;
    const selectedPendingItems = pendingSalesDetails[selectedPendingSale.id]?.items || [];

    return (
      <div className="section-card pending-detail-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={() => setActiveView(SALES_PENDING)}
            aria-label="Voltar para pendências"
          >
            ←
          </button>
        </div>
        <h3>Comanda #{selectedPendingSale.id}</h3>
        <p className="muted">
          Cliente: {selectedPendingSale.client_name || "-"} | Total: {formatMoney(selectedPendingSale.total)}{" "}
          | Criada em: {formatDateTimeBR(selectedPendingSale.created_at)}
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedPendingItems.length ? (
                selectedPendingItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>{formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="muted">
                    Itens indisponíveis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="comanda-subcard">
          <h4>Finalização</h4>
          <div className="sale-summary-metrics">
            <div className="sale-metric-card is-highlight">
              <span>Total pendente</span>
              <strong>{formatMoney(selectedPendingTotal)}</strong>
            </div>
          </div>
          <div className="inline-form pending-finalize-form">
            <label>
              Pagamento
              <select
                value={settleMethod}
                onChange={(event) =>
                  setSettleMethodBySale((prev) => ({ ...prev, [selectedPendingSale.id]: event.target.value }))
                }
              >
                <option value="DINHEIRO">{PAYMENT_LABELS.DINHEIRO}</option>
                <option value="PIX">{PAYMENT_LABELS.PIX}</option>
                <option value="CARTAO">{PAYMENT_LABELS.CARTAO}</option>
              </select>
            </label>
            {settleMethod === "DINHEIRO" ? (
              <label>
                Valor recebido
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={settleAmount}
                  onChange={(event) =>
                    setSettleAmountBySale((prev) => ({
                      ...prev,
                      [selectedPendingSale.id]: formatMoneyInput(event.target.value),
                    }))
                  }
                  required
                />
              </label>
            ) : null}
            {settleMethod === "DINHEIRO" ? (
              <label>
                Troco estimado
                <input type="text" value={formatMoney(selectedPendingChange)} readOnly />
              </label>
            ) : null}
            <div className="pending-finalize-actions">
              <button
                className="btn-primary"
                type="button"
                disabled={saving}
                onClick={() => handleSettlePendingSale(selectedPendingSale.id, settleMethod, settleAmount)}
              >
                Quitar comanda
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderHistoryTab() {
    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={() => setActiveView(SALES_HOME)}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Histórico de Finalizadas</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Desconto</th>
                <th>Quitada em</th>
              </tr>
            </thead>
            <tbody>
              {historySales.map((history) => (
                <tr key={history.id}>
                  <td>{history.id}</td>
                  <td>{history.client_name || "-"}</td>
                  <td>{formatPaymentMethod(history.payment_method)}</td>
                  <td>{formatMoney(history.total)}</td>
                  <td>{Number(history.discount_percent || 0)}%</td>
                  <td>{history.settled_at ? formatDateTimeBR(history.settled_at) : "Pendente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={historyPage}
          totalPages={historyTotalPages}
          onPageChange={loadHistoryPage}
        />
      </div>
    );
  }

  function renderCashCloseTab() {
    const closure = cashCloseStatus?.closure || null;
    const isClosed = Boolean(cashCloseStatus?.closed);
    const byPayment = cashCloseSummary?.by_payment || [];

    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={() => setActiveView(isAdmin ? SALES_CASH_CLOSE_MENU : SALES_HOME)}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Fechamento de Caixa</h3>
        <p className="muted">Conferência e fechamento oficial do movimento diário.</p>

        <div className="inline-form">
          <label>
            Data do fechamento (automática)
            <input type="text" value={formatDateBR(cashCloseDate)} readOnly />
          </label>
          <div className="inline-row">
            <button
              className="btn-primary"
              type="button"
              onClick={() => loadCashCloseData()}
              disabled={cashCloseLoading}
            >
              Atualizar
            </button>
            <button
              className="btn-danger"
              type="button"
              onClick={handleCloseCashDay}
              disabled={saving || cashCloseLoading || isClosed}
            >
              {isClosed ? "Caixa já fechado" : "Fechar caixa do dia"}
            </button>
          </div>
        </div>

        {cashCloseLoading ? <p className="state-message">Carregando fechamento...</p> : null}

        {cashCloseSummary ? (
          <div className="comanda-subcard">
            <h4>Resumo do dia {formatDateBR(cashCloseSummary.date)}</h4>
            <div className="sale-summary-metrics">
              <div className="sale-metric-card is-highlight">
                <span>Total vendido</span>
                <strong>{formatMoney(cashCloseSummary.total_sold)}</strong>
              </div>
              <div className="sale-metric-card">
                <span>Vendas finalizadas</span>
                <strong>{Number(cashCloseSummary.sales_count || 0)}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th>Qtd</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byPayment.length ? (
                    byPayment.map((item) => (
                      <tr key={item.payment_method}>
                        <td>{formatPaymentMethod(item.payment_method)}</td>
                        <td>{Number(item.sales_count || 0)}</td>
                        <td>{formatMoney(item.total_sold)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="muted">
                        Sem vendas finalizadas nessa data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {isClosed && closure ? (
          <p className="state-message">
            Caixa fechado por {closure.closed_by_name || "-"} em {formatDateTimeBR(closure.closed_at)}.
          </p>
        ) : (
          <p className="muted">Caixa ainda não fechado para esta data.</p>
        )}
      </div>
    );
  }

  function renderCashReopenTab() {
    const closure = cashCloseStatus?.closure || null;
    const isClosed = Boolean(cashCloseStatus?.closed);

    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={() => setActiveView(SALES_CASH_CLOSE_MENU)}
            aria-label="Voltar ao menu de fechamento"
          >
            ←
          </button>
        </div>
        <h3>Editar Caixa Fechado</h3>
        <p className="muted">Use esta opção apenas quando o caixa do dia foi fechado por engano.</p>

        <div className="inline-form">
          <label>
            Data do fechamento (automática)
            <input type="text" value={formatDateBR(cashCloseDate)} readOnly />
          </label>
          <div className="inline-row">
            <button
              className="btn-primary"
              type="button"
              onClick={() => loadCashCloseData()}
              disabled={cashCloseLoading}
            >
              Atualizar
            </button>
            <button
              className="btn-danger"
              type="button"
              onClick={handleReopenCashDay}
              disabled={saving || cashCloseLoading || !isClosed}
            >
              {isClosed ? "Reabrir caixa do dia" : "Caixa já está aberto"}
            </button>
          </div>
        </div>

        {cashCloseLoading ? <p className="state-message">Carregando fechamento...</p> : null}

        {isClosed && closure ? (
          <p className="state-message">
            Caixa fechado por {closure.closed_by_name || "-"} em {formatDateTimeBR(closure.closed_at)}.
          </p>
        ) : (
          <p className="muted">Não existe fechamento ativo para a data atual.</p>
        )}
      </div>
    );
  }

  function renderCashCloseMenu() {
    if (!isAdmin) {
      return renderCashCloseTab();
    }

    return (
      <div className="menu-grid">
        <CardMenu
          icon="cash-close"
          title="Fechar Caixa"
          description="Conferir resumo e fechar o dia"
          onClick={() => {
            setActiveView(SALES_CASH_CLOSE);
            loadCashCloseData();
          }}
        />
        <CardMenu
          icon="cash-reopen"
          title="Editar Caixa Fechado"
          description="Reabrir fechamento quando necessário"
          onClick={() => {
            setActiveView(SALES_CASH_REOPEN);
            loadCashCloseData();
          }}
        />
      </div>
    );
  }

  function renderSalesMenu() {
    return (
      <div className="menu-grid">
        <CardMenu
          icon="sales"
          title="Nova Venda"
          description="Abrir comanda e finalizar venda"
          onClick={() => setActiveView(SALES_COMANDA)}
        />
        <CardMenu
          icon="pending"
          title="Vendas Pendentes"
          description="Quitar vendas a prazo"
          onClick={() => setActiveView(SALES_PENDING)}
        />
        <CardMenu
          icon="cash-close"
          title="Fechamento de Caixa"
          description="Conferir e fechar caixa do dia"
          onClick={() => {
            setActiveView(isAdmin ? SALES_CASH_CLOSE_MENU : SALES_CASH_CLOSE);
            loadCashCloseData();
          }}
        />
        <CardMenu
          icon="history"
          title="Histórico"
          description="Consultar finalizadas"
          onClick={() => setActiveView(SALES_HISTORY)}
        />
      </div>
    );
  }

  return (
    <section className="sales-page">
      <h2>Vendas</h2>
      {loading ? <p className="state-message">Carregando vendas...</p> : null}

      {!loading && activeView === SALES_HOME ? renderSalesMenu() : null}
      {!loading && activeView === SALES_COMANDA ? renderComandaTab() : null}
      {!loading && activeView === SALES_PENDING ? renderPendingTab() : null}
      {!loading && activeView === SALES_PENDING_DETAIL ? renderPendingDetailTab() : null}
      {!loading && activeView === SALES_CASH_CLOSE_MENU ? renderCashCloseMenu() : null}
      {!loading && activeView === SALES_CASH_CLOSE ? renderCashCloseTab() : null}
      {!loading && activeView === SALES_CASH_REOPEN ? renderCashReopenTab() : null}
      {!loading && activeView === SALES_HISTORY ? renderHistoryTab() : null}
    </section>
  );
}

export default Sales;
