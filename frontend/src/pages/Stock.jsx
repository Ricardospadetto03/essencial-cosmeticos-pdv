import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import CardMenu from "../components/CardMenu";
import { formatDateBR } from "../utils/dateFormat";
import { showToast } from "../utils/toast";
import { useAuth } from "../hooks/useAuth";
import PaginationControls from "../components/PaginationControls";
import { formatMoney } from "../utils/money";

const STOCK_HOME = "HOME";
const STOCK_PRODUCTS = "PRODUCTS";
const STOCK_REPLENISHMENT = "REPLENISHMENT";
const STOCK_EXPIRATION = "EXPIRATION";
const STOCK_MOVEMENT = "MOVEMENT";
const EXPIRATION_ALERT_DAYS = 30;
const HIDDEN_STOCK_PRODUCTS_KEY = "essencial_hidden_stock_products";
// Tamanho de página da tabela de produtos (paginação apenas de exibição:
// a lista completa continua carregada para alimentar o autocomplete de
// movimentação de estoque e o filtro de produtos ocultos).
const PRODUCTS_PAGE_SIZE = 20;

function readHiddenProductIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_STOCK_PRODUCTS_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    // Ignora estado inválido de localStorage.
    return [];
  }
}

function Stock() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [expirationAlerts, setExpirationAlerts] = useState([]);
  const [replenishmentList, setReplenishmentList] = useState([]);

  const [search, setSearch] = useState("");
  const [productsPage, setProductsPage] = useState(1);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [movementProductSearch, setMovementProductSearch] = useState("");
  const [showMovementSuggestions, setShowMovementSuggestions] = useState(false);
  const [movementQuantity, setMovementQuantity] = useState("");

  const [viewMode, setViewMode] = useState(STOCK_HOME);
  const [hiddenProductIds, setHiddenProductIds] = useState(readHiddenProductIds);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasLoadedAlertsRef = useRef(false);
  const previousExpirationIdsRef = useRef(new Set());
  const previousReplenishmentIdsRef = useRef(new Set());

  const filteredProducts = useMemo(() => {
    const hiddenSet = new Set(hiddenProductIds);
    const term = search.trim().toLowerCase();
    const visibleProducts = products.filter((product) => !hiddenSet.has(Number(product.id)));
    if (!term) return visibleProducts;
    return visibleProducts.filter((product) => {
      const text = `${product.name || ""} ${product.brand || ""}`.toLowerCase();
      return text.includes(term);
    });
  }, [products, search, hiddenProductIds]);
  useEffect(() => {
    setProductsPage(1);
  }, [search]);
  const productsTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE));
  const safeProductsPage = Math.min(productsPage, productsTotalPages);
  const pagedProducts = useMemo(
    () =>
      filteredProducts.slice(
        (safeProductsPage - 1) * PRODUCTS_PAGE_SIZE,
        safeProductsPage * PRODUCTS_PAGE_SIZE
      ),
    [filteredProducts, safeProductsPage]
  );
  const movementFilteredProducts = useMemo(() => {
    const term = movementProductSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      String(product.name || "")
        .toLowerCase()
        .includes(term)
    );
  }, [products, movementProductSearch]);
  const movementSuggestions = useMemo(() => movementFilteredProducts.slice(0, 8), [movementFilteredProducts]);
  const selectedMovementProduct = useMemo(
    () => products.find((product) => String(product.id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  );

  async function loadData() {
    setLoading(true);
    try {
      const [productsRes, expRes, replRes] = await Promise.all([
        api.get("/products"),
        api.get(`/stock/alerts/expiration?days=${encodeURIComponent(EXPIRATION_ALERT_DAYS)}`),
        // Força regra de reposição baseada no estoque mínimo cadastrado.
        api.get("/stock/replenishment?threshold=0"),
      ]);

      const nextExpirationIds = new Set((expRes.data || []).map((item) => item.id));
      const hiddenSet = new Set(hiddenProductIds);
      const replenishmentByMinimum = (replRes.data || [])
        .filter((item) => Number(item.stock) < Number(item.minimum_stock))
        .filter((item) => !hiddenSet.has(Number(item.id)));
      const nextReplenishmentIds = new Set(replenishmentByMinimum.map((item) => item.id));

      if (hasLoadedAlertsRef.current) {
        const newExpirationItems = (expRes.data || []).filter(
          (item) => !previousExpirationIdsRef.current.has(item.id)
        );
        const newReplenishmentItems = replenishmentByMinimum.filter(
          (item) => !previousReplenishmentIdsRef.current.has(item.id)
        );

        if (newExpirationItems.length) {
          showToast(`${newExpirationItems.length} item(ns) entrou(aram) no alerta de validade.`, "info");
        }

        if (newReplenishmentItems.length) {
          showToast(`${newReplenishmentItems.length} item(ns) entrou(aram) na lista de reposição.`, "info");
        }
      }

      setProducts(productsRes.data);
      setExpirationAlerts(expRes.data);
      setReplenishmentList(replenishmentByMinimum);
      previousExpirationIdsRef.current = nextExpirationIds;
      previousReplenishmentIdsRef.current = nextReplenishmentIds;
      hasLoadedAlertsRef.current = true;
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao carregar dados de estoque.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.state?.viewMode === STOCK_PRODUCTS) {
      setViewMode(STOCK_PRODUCTS);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  // Regra: positivo = entrada; negativo = ajuste/saída.
  async function handleApplyMovement() {
    if (!selectedProductId || !movementQuantity) return;
    const quantity = Number(movementQuantity);
    if (!Number.isInteger(quantity) || quantity === 0) {
      showToast("Informe uma quantidade válida diferente de zero.", "error");
      return;
    }

    setSaving(true);
    try {
      if (quantity > 0) {
        await api.post(`/products/${selectedProductId}/stock/entry`, { quantity });
      } else {
        await api.post(`/products/${selectedProductId}/stock/adjustment`, { quantity });
      }
      setMovementQuantity("");
      showToast("Estoque ajustado!", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao aplicar movimentação.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleHideProductFromStockList(product) {
    const shouldHide = window.confirm(
      `Ocultar "${product.name}" da listagem de estoque? O produto não será apagado do banco.`
    );
    if (!shouldHide) return;

    setHiddenProductIds((prev) => {
      const next = Array.from(new Set([...prev, Number(product.id)]));
      localStorage.setItem(HIDDEN_STOCK_PRODUCTS_KEY, JSON.stringify(next));
      return next;
    });
    setReplenishmentList((prev) => prev.filter((item) => Number(item.id) !== Number(product.id)));
    showToast(`Produto "${product.name}" ocultado da listagem de estoque.`, "success");
  }

  function handleReplenishNow(item) {
    const suggestedQuantity = Math.max(1, Number(item?.quantity_to_replenish || 1));
    setSelectedProductId(String(item.id));
    setMovementProductSearch(item.name || "");
    setShowMovementSuggestions(false);
    setMovementQuantity(String(suggestedQuantity));
    setViewMode(STOCK_MOVEMENT);
    showToast(`Reposição rápida: ${item.name} selecionado com quantidade ${suggestedQuantity}.`, "success");
  }

  function handleMovementProductSearchChange(nextValue) {
    setMovementProductSearch(nextValue);
    setShowMovementSuggestions(true);
    const normalized = nextValue.trim().toLowerCase();
    const exactMatch = products.find((product) => String(product.name || "").toLowerCase() === normalized);
    setSelectedProductId(exactMatch ? String(exactMatch.id) : "");
  }

  function handleSelectMovementProduct(product) {
    setMovementProductSearch(product.name);
    setSelectedProductId(String(product.id));
    setShowMovementSuggestions(false);
  }

  async function handleDownloadReplenishmentPdf() {
    try {
      const response = await api.get("/stock/replenishment/pdf?threshold=0", {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "lista-reposicao.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao baixar PDF da reposição.", "error");
    }
  }

  function handleBackToMenu() {
    setViewMode(STOCK_HOME);
  }

  function renderStockMenu() {
    return (
      <div className="menu-grid">
        <CardMenu
          icon="stock"
          title="Verificar Estoque"
          description="Buscar e consultar lista de produtos"
          onClick={() => setViewMode(STOCK_PRODUCTS)}
        />
        <CardMenu
          icon="replenishment"
          title="Lista de Reposição"
          description="Sugestões automáticas e PDF"
          onClick={() => setViewMode(STOCK_REPLENISHMENT)}
        />
        <CardMenu
          icon="expiration"
          title="Alerta de Validade"
          description="Produtos próximos do vencimento"
          onClick={() => setViewMode(STOCK_EXPIRATION)}
        />
        <CardMenu
          icon="movement"
          title="Ajuste de Estoque"
          description="Entrada e ajuste de estoque"
          onClick={() => setViewMode(STOCK_MOVEMENT)}
        />
      </div>
    );
  }

  function renderProductsView() {
    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={handleBackToMenu}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Verificar Estoque</h3>
        <label>
          Buscar produto
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex: batom"
          />
        </label>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Marca</th>
                <th>Tam.</th>
                <th>Estoque</th>
                {isAdmin ? <th>Custo</th> : null}
                <th>Venda</th>
                {isAdmin ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {pagedProducts.length ? (
                pagedProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{product.name}</td>
                    <td>{product.brand || "-"}</td>
                    <td>{product.size || "-"}</td>
                    <td>{product.stock}</td>
                    {isAdmin ? <td>{formatMoney(product.purchase_price)}</td> : null}
                    <td>{formatMoney(product.sale_price)}</td>
                    {isAdmin ? (
                      <td>
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() =>
                            navigate(`/stock/products/${product.id}/edit`, {
                              state: { from: "/stock", viewMode: STOCK_PRODUCTS },
                            })
                          }
                        >
                          Editar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="muted">
                    Nenhum produto encontrado para a busca informada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={safeProductsPage}
          totalPages={productsTotalPages}
          onPageChange={setProductsPage}
        />
      </div>
    );
  }

  function renderReplenishmentView() {
    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={handleBackToMenu}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Lista de Reposição</h3>
        <p className="muted">Itens com estoque abaixo do mínimo.</p>
        <div className="inline-row">
          <button className="btn-primary" type="button" onClick={loadData}>
            Atualizar lista
          </button>
          <button className="btn-ghost" type="button" onClick={handleDownloadReplenishmentPdf}>
            Baixar PDF
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Mínimo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {replenishmentList.length ? (
                replenishmentList.map((item) => (
                  <tr key={`rep-${item.id}`}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.stock}</td>
                    <td>{item.minimum_stock}</td>
                    <td className="inline-actions">
                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() => handleHideProductFromStockList(item)}
                        disabled={saving}
                      >
                        Excluir da lista
                      </button>
                      <button className="btn-primary" type="button" onClick={() => handleReplenishNow(item)}>
                        Repor agora
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="muted">
                    Nenhum item abaixo do estoque mínimo cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderExpirationView() {
    return (
      <div className="section-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={handleBackToMenu}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Alerta de Validade</h3>
        <div className="inline-row">
          <button className="btn-primary" type="button" onClick={loadData}>
            Atualizar alertas
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Produto</th>
                <th>Validade</th>
                <th>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {expirationAlerts.length ? (
                expirationAlerts.map((item) => (
                  <tr key={`exp-${item.id}`}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{formatDateBR(item.expiration_date)}</td>
                    <td>{item.stock}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="muted">
                    Nenhum produto com validade crítica nos próximos 30 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderMovementView() {
    return (
      <div className="section-card stock-movement-card">
        <div className="inline-row">
          <button
            className="back-arrow-btn"
            type="button"
            onClick={handleBackToMenu}
            aria-label="Voltar ao menu"
          >
            ←
          </button>
        </div>
        <h3>Ajuste de Estoque</h3>
        <p className="muted">Use valor positivo para entrada e negativo para ajuste/saída.</p>
        <div className="comanda-subcard stock-movement-form">
          <div className="stock-movement-grid">
            <label className="autocomplete-wrap stock-movement-product">
              Produto
              <input
                type="text"
                value={movementProductSearch}
                onChange={(event) => handleMovementProductSearchChange(event.target.value)}
                onFocus={() => setShowMovementSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowMovementSuggestions(false), 120);
                }}
                placeholder="Digite o nome do produto"
                autoComplete="off"
                required
              />
              {showMovementSuggestions ? (
                <div className="autocomplete-list">
                  {movementSuggestions.length ? (
                    movementSuggestions.map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        className="autocomplete-item"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectMovementProduct(product)}
                      >
                        #{product.id} - {product.name}
                        <span>Saldo: {product.stock}</span>
                      </button>
                    ))
                  ) : (
                    <p className="autocomplete-empty">Nenhum produto encontrado.</p>
                  )}
                </div>
              ) : null}
            </label>
            <label className="stock-movement-quantity">
              Quantidade
              <input
                type="number"
                value={movementQuantity}
                onChange={(event) => setMovementQuantity(event.target.value)}
                placeholder="Ex: 10 ou -2"
              />
            </label>
            <div className="stock-movement-action">
              <button className="btn-primary" type="button" onClick={handleApplyMovement} disabled={saving}>
                Aplicar ajuste
              </button>
            </div>
          </div>
          <small className="stock-hint">
            {selectedMovementProduct
              ? `Saldo atual: ${selectedMovementProduct.stock}`
              : "Selecione um produto para visualizar o saldo atual."}
          </small>
        </div>
      </div>
    );
  }

  return (
    <section className="stock-page">
      <h2>Estoque</h2>
      {loading ? <p className="state-message">Carregando estoque...</p> : null}

      {!loading && viewMode === STOCK_HOME ? renderStockMenu() : null}
      {!loading && viewMode === STOCK_PRODUCTS ? renderProductsView() : null}
      {!loading && viewMode === STOCK_REPLENISHMENT ? renderReplenishmentView() : null}
      {!loading && viewMode === STOCK_EXPIRATION ? renderExpirationView() : null}
      {!loading && viewMode === STOCK_MOVEMENT ? renderMovementView() : null}
    </section>
  );
}

export default Stock;
