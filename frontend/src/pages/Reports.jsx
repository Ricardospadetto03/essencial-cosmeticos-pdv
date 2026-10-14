import React, { useEffect, useMemo, useState } from "react";
import CardMenu from "../components/CardMenu";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { formatDateBR, getTodayIsoDate } from "../utils/dateFormat";
import { showToast } from "../utils/toast";
import { formatMoney } from "../utils/money";
import { formatPaymentMethod } from "../utils/labels";

function Reports() {
  const VIEW_MENU = "MENU";
  const VIEW_DAILY = "DAILY";
  const VIEW_MONTHLY = "MONTHLY";

  function getDaysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
  }

  function buildIsoDate(year, month, day) {
    return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getYesterdayIsoDate() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCurrentMonthYear() {
    const now = new Date();
    return {
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    };
  }

  function paymentColorClass(method) {
    const normalized = String(method || "").toUpperCase();
    if (normalized === "DINHEIRO") return "is-cash";
    if (normalized === "PIX") return "is-pix";
    if (normalized === "CARTAO" || normalized === "CARTÃO") return "is-card";
    return "is-other";
  }

  const { isAdmin } = useAuth();

  const [viewMode, setViewMode] = useState(VIEW_MENU);

  const [dailyDate, setDailyDate] = useState(getTodayIsoDate());
  const [dailyYear, setDailyYear] = useState(String(new Date().getFullYear()));
  const [dailyMonth, setDailyMonth] = useState(String(new Date().getMonth() + 1));
  const [dailyDay, setDailyDay] = useState(String(new Date().getDate()));
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()));
  const [monthlyMonth, setMonthlyMonth] = useState(String(new Date().getMonth() + 1));

  const [dailySummary, setDailySummary] = useState(null);
  const [monthlyDashboard, setMonthlyDashboard] = useState(null);

  const [loading, setLoading] = useState(true);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = currentYear - 5;
    const end = currentYear + 1;
    const years = [];
    for (let year = end; year >= start; year -= 1) years.push(String(year));
    return years;
  }, []);

  const monthOptions = useMemo(
    () => [
      { value: "1", label: "Janeiro" },
      { value: "2", label: "Fevereiro" },
      { value: "3", label: "Março" },
      { value: "4", label: "Abril" },
      { value: "5", label: "Maio" },
      { value: "6", label: "Junho" },
      { value: "7", label: "Julho" },
      { value: "8", label: "Agosto" },
      { value: "9", label: "Setembro" },
      { value: "10", label: "Outubro" },
      { value: "11", label: "Novembro" },
      { value: "12", label: "Dezembro" },
    ],
    []
  );

  const maxDailyDay = useMemo(() => getDaysInMonth(dailyYear, dailyMonth), [dailyYear, dailyMonth]);

  async function loadReports(nextFilters = {}) {
    setLoading(true);
    try {
      const resolvedDailyDate =
        typeof nextFilters.dailyDate !== "undefined" ? nextFilters.dailyDate : dailyDate;
      const resolvedYear = nextFilters.monthlyYear || monthlyYear;
      const resolvedMonth = nextFilters.monthlyMonth || monthlyMonth;

      const dailyQuery = resolvedDailyDate ? `?date=${encodeURIComponent(resolvedDailyDate)}` : "";
      const monthlyQuery = `?year=${encodeURIComponent(resolvedYear)}&month=${encodeURIComponent(resolvedMonth)}`;

      const [dailyResponse, monthlyResponse] = await Promise.all([
        api.get(`/cash/summary/daily${dailyQuery}`),
        api.get(`/dashboard/monthly${monthlyQuery}`),
      ]);

      setDailySummary(dailyResponse.data);
      setMonthlyDashboard(monthlyResponse.data);
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao carregar relatórios.", "error");
    } finally {
      setLoading(false);
    }
  }

  function applyDailyFilter(nextYear, nextMonth, nextDay) {
    const safeYear = String(nextYear);
    const safeMonth = String(nextMonth);
    const maxDay = getDaysInMonth(safeYear, safeMonth);
    const safeDay = String(Math.min(Number(nextDay), maxDay));
    const isoDate = buildIsoDate(safeYear, safeMonth, safeDay);

    setDailyYear(safeYear);
    setDailyMonth(safeMonth);
    setDailyDay(safeDay);
    setDailyDate(isoDate);
    return isoDate;
  }

  function syncDailyStateFromIso(isoDate) {
    const [year, month, day] = String(isoDate).split("-");
    setDailyYear(String(Number(year)));
    setDailyMonth(String(Number(month)));
    setDailyDay(String(Number(day)));
    setDailyDate(isoDate);
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soldDiffLabel = useMemo(() => {
    const current = Number(monthlyDashboard?.current_month?.total_sold || 0);
    const previous = Number(monthlyDashboard?.previous_month?.total_sold || 0);

    if (previous === 0 && current === 0) return "Sem vendas nos dois meses";
    if (previous === 0 && current > 0) return "Novo faturamento";

    return `${(((current - previous) / previous) * 100).toFixed(2)}%`;
  }, [monthlyDashboard]);

  const paymentCards = useMemo(() => {
    const source = Array.isArray(dailySummary?.by_payment) ? dailySummary.by_payment : [];
    const grouped = source.reduce((acc, item) => {
      const method = String(item?.payment_method || "OUTROS").toUpperCase();
      if (!acc[method]) {
        acc[method] = {
          method,
          salesCount: 0,
          totalSold: 0,
        };
      }
      acc[method].salesCount += Number(item?.sales_count || 0);
      acc[method].totalSold += Number(item?.total_sold || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.totalSold - a.totalSold);
  }, [dailySummary]);

  const paymentTotal = useMemo(
    () => paymentCards.reduce((acc, item) => acc + Number(item.totalSold || 0), 0),
    [paymentCards]
  );

  const monthlyPaymentCards = useMemo(() => {
    const source = Array.isArray(monthlyDashboard?.current_month?.by_payment)
      ? monthlyDashboard.current_month.by_payment
      : [];
    return source
      .map((row) => ({
        method: String(row?.payment_method || "OUTROS").toUpperCase(),
        salesCount: Number(row?.sales_count || 0),
        totalSold: Number(row?.total_sold || 0),
      }))
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [monthlyDashboard]);

  const monthlyPaymentTotal = useMemo(
    () => monthlyPaymentCards.reduce((acc, item) => acc + Number(item.totalSold || 0), 0),
    [monthlyPaymentCards]
  );

  const monthlyCompare = useMemo(() => {
    const current = Number(monthlyDashboard?.current_month?.total_sold || 0);
    const previous = Number(monthlyDashboard?.previous_month?.total_sold || 0);
    const max = Math.max(current, previous, 1);
    return {
      current,
      previous,
      currentPercent: (current / max) * 100,
      previousPercent: (previous / max) * 100,
      deltaPercent: previous ? ((current - previous) / previous) * 100 : null,
    };
  }, [monthlyDashboard]);

  const dailySoldProducts = useMemo(
    () => (Array.isArray(dailySummary?.sold_products) ? dailySummary.sold_products : []),
    [dailySummary]
  );

  const monthlySoldProducts = useMemo(
    () =>
      Array.isArray(monthlyDashboard?.current_month?.sold_products)
        ? monthlyDashboard.current_month.sold_products
        : [],
    [monthlyDashboard]
  );

  async function handleDownloadPdf() {
    try {
      const query = `?year=${encodeURIComponent(monthlyYear)}&month=${encodeURIComponent(monthlyMonth)}`;
      const response = await api.get(`/reports/monthly/pdf${query}`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `relatorio-mensal-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao baixar PDF mensal.", "error");
    }
  }

  return (
    <section className={`reports-page ${viewMode === VIEW_MENU ? "reports-page-menu" : ""}`}>
      <h2>Relatórios</h2>

      {viewMode === VIEW_MENU ? (
        <>
          <div className="menu-grid reports-menu-grid">
            <CardMenu
              icon="cash-close"
              title="Caixa Diário"
              description="Resumo do dia, itens vendidos e lucro."
              onClick={() => setViewMode(VIEW_DAILY)}
            />
            <CardMenu
              icon="reports"
              title="Dashboard Mensal"
              description="Indicadores do mês, itens vendidos e comparativo."
              onClick={() => setViewMode(VIEW_MONTHLY)}
            />
          </div>
        </>
      ) : null}

      {viewMode === VIEW_DAILY ? (
        <>
          <div className="section-card reports-filters-card">
            <div className="reports-panel-head">
              <button
                className="back-arrow-btn"
                type="button"
                onClick={() => setViewMode(VIEW_MENU)}
                aria-label="Voltar ao menu de relatórios"
              >
                ←
              </button>
              <h3>Caixa diário</h3>
            </div>

            <div className="reports-filter-panel">
              <div className="reports-filter-day-wrap">
                <label className="reports-filter-label">
                  Dia
                  <input
                    type="number"
                    min="1"
                    max={maxDailyDay}
                    value={dailyDay}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, "");
                      setDailyDay(raw || "1");
                    }}
                    onBlur={() => applyDailyFilter(dailyYear, dailyMonth, dailyDay)}
                  />
                </label>
                <label className="reports-filter-label">
                  Mês
                  <select
                    value={dailyMonth}
                    onChange={(event) => applyDailyFilter(dailyYear, event.target.value, dailyDay)}
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="reports-filter-label">
                  Ano
                  <select
                    value={dailyYear}
                    onChange={(event) => applyDailyFilter(event.target.value, dailyMonth, dailyDay)}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="reports-inline-actions reports-inline-actions-daily">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    const value = getTodayIsoDate();
                    syncDailyStateFromIso(value);
                    loadReports({ dailyDate: value });
                  }}
                >
                  Hoje
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    const value = getYesterdayIsoDate();
                    syncDailyStateFromIso(value);
                    loadReports({ dailyDate: value });
                  }}
                >
                  Ontem
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    const value = getTodayIsoDate();
                    syncDailyStateFromIso(value);
                    loadReports({ dailyDate: value });
                  }}
                >
                  Resetar
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    const isoDate = applyDailyFilter(dailyYear, dailyMonth, dailyDay);
                    loadReports({ dailyDate: isoDate });
                  }}
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
          {loading ? <p className="state-message">Carregando caixa diário...</p> : null}

          {!loading && dailySummary ? (
            <div className="section-card reports-section-card">
              <h3>Resumo Diário</h3>
              <div className="reports-kpi-grid">
                <div className="sale-metric-card">
                  <span>Data</span>
                  <strong>{formatDateBR(dailySummary.date)}</strong>
                </div>
                <div className="sale-metric-card is-highlight">
                  <span>Total vendido</span>
                  <strong>{formatMoney(Number(dailySummary.total_sold || 0))}</strong>
                </div>
                <div className="sale-metric-card">
                  <span>Vendas no dia</span>
                  <strong>{Number(dailySummary.sales_count || 0)}</strong>
                </div>
                <div className="sale-metric-card">
                  <span>Lucro estimado</span>
                  <strong>{formatMoney(Number(dailySummary.estimated_profit || 0))}</strong>
                </div>
              </div>

              <h4 className="reports-subtitle">Por forma de pagamento</h4>
              <div className="payment-breakdown-list">
                {paymentCards.length ? (
                  paymentCards.map((item) => (
                    <div key={item.method} className="payment-breakdown-item">
                      <div className="payment-breakdown-head">
                        <span className={`payment-method-chip ${paymentColorClass(item.method)}`}>
                          {formatPaymentMethod(item.method)}
                        </span>
                        <strong>
                          {paymentTotal > 0
                            ? `${((Number(item.totalSold || 0) / paymentTotal) * 100).toFixed(1)}%`
                            : "0.0%"}
                        </strong>
                      </div>
                      <div className="payment-breakdown-track" aria-hidden="true">
                        <span
                          className={`payment-breakdown-fill ${paymentColorClass(item.method)}`}
                          style={{
                            width: `${paymentTotal > 0 ? (Number(item.totalSold || 0) / paymentTotal) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="payment-breakdown-meta">
                        <strong>{formatMoney(item.totalSold)}</strong>
                        <small>{item.salesCount} venda(s)</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sem dados por forma de pagamento nesta data.</p>
                )}
              </div>

              <h4 className="reports-subtitle">Itens vendidos no dia</h4>
              {dailySoldProducts.length ? (
                <div className="table-wrap reports-products-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Total</th>
                        <th>Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySoldProducts.map((item) => (
                        <tr key={`daily-product-${item.product_id}`}>
                          <td>{item.product_name}</td>
                          <td>{Number(item.total_quantity || 0)}</td>
                          <td>{formatMoney(Number(item.gross_total || 0))}</td>
                          <td>{formatMoney(Number(item.estimated_profit || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Nenhum item vendido na data selecionada.</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {viewMode === VIEW_MONTHLY ? (
        <>
          <div className="section-card reports-filters-card">
            <div className="reports-panel-head">
              <button
                className="back-arrow-btn"
                type="button"
                onClick={() => setViewMode(VIEW_MENU)}
                aria-label="Voltar ao menu de relatórios"
              >
                ←
              </button>
              <h3>Dashboard mensal</h3>
            </div>

            <div className="reports-filter-panel">
              <div className="reports-filter-month-wrap">
                <label className="reports-filter-label">
                  Mês
                  <select value={monthlyMonth} onChange={(event) => setMonthlyMonth(event.target.value)}>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="reports-filter-label">
                  Ano
                  <select value={monthlyYear} onChange={(event) => setMonthlyYear(event.target.value)}>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="reports-inline-actions reports-inline-actions-monthly">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    const { month, year } = getCurrentMonthYear();
                    setMonthlyMonth(month);
                    setMonthlyYear(year);
                    loadReports({ monthlyMonth: month, monthlyYear: year });
                  }}
                >
                  Mês atual
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const currentYear = String(now.getFullYear());
                    const currentMonth = String(now.getMonth() + 1);
                    setMonthlyYear(currentYear);
                    setMonthlyMonth(currentMonth);
                    loadReports({ monthlyYear: currentYear, monthlyMonth: currentMonth });
                  }}
                >
                  Resetar
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => loadReports({ monthlyMonth, monthlyYear })}
                >
                  Buscar
                </button>
                <button className="btn-ghost" type="button" onClick={handleDownloadPdf}>
                  Baixar PDF mensal
                </button>
              </div>
            </div>
          </div>
          {loading ? <p className="state-message">Carregando dashboard mensal...</p> : null}

          {!loading && monthlyDashboard ? (
            <div className="section-card reports-section-card">
              <h3>Indicadores do mês</h3>
              <div className="reports-monthly-grid">
                <div className="sale-metric-card is-highlight">
                  <span>Total vendido (mês)</span>
                  <strong>{formatMoney(Number(monthlyDashboard.current_month?.total_sold || 0))}</strong>
                </div>
                <div className="sale-metric-card">
                  <span>Vendas (mês)</span>
                  <strong>{Number(monthlyDashboard.current_month?.sales_count || 0)}</strong>
                </div>
                <div className="sale-metric-card">
                  <span>Diferença vs mês anterior</span>
                  <strong>{soldDiffLabel}</strong>
                </div>
                {isAdmin ? (
                  <div className="sale-metric-card">
                    <span>Lucro estimado</span>
                    <strong>
                      {formatMoney(Number(monthlyDashboard.current_month?.estimated_profit || 0))}
                    </strong>
                  </div>
                ) : null}
                <div className="sale-metric-card">
                  <span>Produto mais vendido</span>
                  <strong>{monthlyDashboard.current_month?.top_selling_product?.name || "Sem dados"}</strong>
                </div>
              </div>

              <h4 className="reports-subtitle">Por forma de pagamento (mês)</h4>
              <div className="payment-breakdown-list">
                {monthlyPaymentCards.length ? (
                  monthlyPaymentCards.map((item) => (
                    <div key={`monthly-${item.method}`} className="payment-breakdown-item">
                      <div className="payment-breakdown-head">
                        <span className={`payment-method-chip ${paymentColorClass(item.method)}`}>
                          {formatPaymentMethod(item.method)}
                        </span>
                        <strong>
                          {monthlyPaymentTotal > 0
                            ? `${((Number(item.totalSold || 0) / monthlyPaymentTotal) * 100).toFixed(1)}%`
                            : "0.0%"}
                        </strong>
                      </div>
                      <div className="payment-breakdown-track" aria-hidden="true">
                        <span
                          className={`payment-breakdown-fill ${paymentColorClass(item.method)}`}
                          style={{
                            width: `${monthlyPaymentTotal > 0 ? (Number(item.totalSold || 0) / monthlyPaymentTotal) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="payment-breakdown-meta">
                        <strong>{formatMoney(item.totalSold)}</strong>
                        <small>{item.salesCount} venda(s)</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sem dados de forma de pagamento para o mês selecionado.</p>
                )}
              </div>

              <div className="section-card reports-comparison-card">
                <h4 className="reports-subtitle">Comparativo de faturamento mensal</h4>
                {monthlyCompare.deltaPercent === null ? (
                  <p className="comparison-delta is-neutral">
                    Sem base de comparação: mês anterior sem faturamento.
                  </p>
                ) : (
                  <p
                    className={`comparison-delta ${monthlyCompare.deltaPercent >= 0 ? "is-positive" : "is-negative"}`}
                  >
                    {monthlyCompare.deltaPercent >= 0 ? "Alta de" : "Queda de"}{" "}
                    {Math.abs(monthlyCompare.deltaPercent).toFixed(2)}% em relação ao mês anterior
                  </p>
                )}
                <div className="comparison-list">
                  <div className="comparison-row">
                    <span className="comparison-label">Mês atual</span>
                    <div className="comparison-bar-track" aria-hidden="true">
                      <span
                        className="comparison-bar-fill is-current"
                        style={{ width: `${monthlyCompare.currentPercent}%` }}
                      />
                    </div>
                    <strong className="comparison-value">{formatMoney(monthlyCompare.current)}</strong>
                  </div>
                  <div className="comparison-row">
                    <span className="comparison-label">Mês anterior</span>
                    <div className="comparison-bar-track" aria-hidden="true">
                      <span
                        className="comparison-bar-fill is-previous"
                        style={{ width: `${monthlyCompare.previousPercent}%` }}
                      />
                    </div>
                    <strong className="comparison-value">{formatMoney(monthlyCompare.previous)}</strong>
                  </div>
                </div>
              </div>

              <h4 className="reports-subtitle">Itens vendidos no mês</h4>
              {monthlySoldProducts.length ? (
                <div className="table-wrap reports-products-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Total</th>
                        <th>Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySoldProducts.map((item) => (
                        <tr key={`monthly-product-${item.product_id}`}>
                          <td>{item.product_name}</td>
                          <td>{Number(item.total_quantity || 0)}</td>
                          <td>{formatMoney(Number(item.gross_total || 0))}</td>
                          <td>{formatMoney(Number(item.estimated_profit || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Nenhum item vendido no mês selecionado.</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default Reports;
