import React, { useEffect, useMemo, useState } from "react";
import CardMenu from "../components/CardMenu";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import { showToast } from "../utils/toast";
import { formatMoney } from "../utils/money";

function Dashboard() {
  const { isAdmin } = useAuth();
  const [kpis, setKpis] = useState({
    products: 0,
    expiringSoon: 0,
    lowStock: 0,
    pendingSales: 0,
    dailyTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  const kpiCards = useMemo(
    () => [
      {
        key: "expiringSoon",
        icon: "expiration",
        value: String(kpis.expiringSoon),
        label: "Perto do vencimento",
        hint: kpis.expiringSoon > 0 ? "Próximos 30 dias" : "Nenhum item crítico",
        tone: kpis.expiringSoon > 0 ? "warning" : "success",
      },
      {
        key: "lowStock",
        icon: "stock",
        value: String(kpis.lowStock),
        label: "Estoque baixo",
        hint: kpis.lowStock > 0 ? "Exige reposição" : "Estoque saudável",
        tone: kpis.lowStock > 0 ? "warning" : "success",
      },
      {
        key: "pendingSales",
        icon: "pending",
        value: String(kpis.pendingSales),
        label: "Vendas pendentes",
        hint: kpis.pendingSales > 0 ? "Cobranças em aberto" : "Sem pendências",
        tone: kpis.pendingSales > 0 ? "warning" : "success",
      },
      {
        key: "dailyTotal",
        icon: "cash-close",
        value: formatMoney(kpis.dailyTotal),
        label: "Total vendido hoje",
        hint: kpis.dailyTotal > 0 ? "Movimento ativo" : "Sem vendas hoje",
        tone: kpis.dailyTotal > 0 ? "success" : "neutral",
      },
    ],
    [kpis]
  );

  const moduleCards = useMemo(() => {
    const items = [
      {
        icon: "sales",
        title: "Vendas",
        description: "Abrir comanda e registrar vendas",
        to: "/sales",
        badge:
          kpis.pendingSales > 0
            ? `${kpis.pendingSales} pendente${kpis.pendingSales === 1 ? "" : "s"}`
            : "Sem pendências",
        badgeTone: kpis.pendingSales > 0 ? "warning" : "success",
      },
      {
        icon: "stock",
        title: "Estoque",
        description: "Entrada, ajuste e alertas",
        to: "/stock",
        badge: kpis.lowStock > 0 ? `${kpis.lowStock} alerta${kpis.lowStock === 1 ? "" : "s"}` : "Estoque ok",
        badgeTone: kpis.lowStock > 0 ? "warning" : "success",
      },
    ];

    if (isAdmin) {
      items.unshift({
        icon: "products",
        title: "Produtos",
        description: "Gerenciar cadastro de produtos",
        to: "/products",
        badge: `${kpis.products} produto${kpis.products === 1 ? "" : "s"}`,
        badgeTone: "neutral",
      });

      items.push(
        {
          icon: "reports",
          title: "Relatórios",
          description: "Resumo mensal e indicadores",
          to: "/reports",
          badge: "Admin",
          badgeTone: "neutral",
        },
        {
          icon: "users",
          title: "Usuários",
          description: "Gerenciar contas do sistema",
          to: "/users",
          badge: "Admin",
          badgeTone: "neutral",
        },
        {
          icon: "backup",
          title: "Backup",
          description: "Segurança e cópia do banco",
          to: "/backup",
          badge: "Diário",
          badgeTone: "neutral",
        }
      );
    }

    return items;
  }, [isAdmin, kpis]);

  useEffect(() => {
    async function loadKpis() {
      setLoading(true);
      try {
        const [productsRes, expiringRes, lowRes, pendingRes, dailyRes] = await Promise.all([
          api.get("/products"),
          api.get("/stock/alerts/expiration?days=30"),
          api.get("/stock/alerts/minimum"),
          api.get("/sales/pending/list"),
          api.get("/cash/summary/daily"),
        ]);

        setKpis({
          products: productsRes.data.length,
          expiringSoon: expiringRes.data.length,
          lowStock: lowRes.data.length,
          pendingSales: pendingRes.data.length,
          dailyTotal: Number(dailyRes.data?.total_sold || 0),
        });
      } catch (err) {
        showToast(err?.response?.data?.error || "Falha ao carregar indicadores do dashboard.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadKpis();
  }, []);

  return (
    <section className="dashboard-home">
      <p className="sales-slogan dashboard-subtitle">A sua beleza começa no essencial.</p>
      {loading ? <p className="state-message">Carregando indicadores...</p> : null}

      {!loading ? (
        <div className="dashboard-kpis">
          {kpiCards.map((item, index) => (
            <article
              key={item.key}
              className={`kpi-pill kpi-pill-${item.tone}`}
              style={{ "--card-order": index }}
            >
              <div className="kpi-pill-head">
                <span className="kpi-pill-icon" aria-hidden="true">
                  <AppIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </div>
              <strong>{item.value}</strong>
              <span className="kpi-pill-hint">{item.hint}</span>
            </article>
          ))}
        </div>
      ) : null}

      <div className="menu-grid dashboard-modules-grid dashboard-modules-grid-minimal">
        {moduleCards.map((item, index) => (
          <CardMenu
            key={item.title}
            icon={item.icon}
            title={item.title}
            description=""
            to={item.to}
            badge=""
            badgeTone={item.badgeTone}
            animationIndex={index + 4}
          />
        ))}
      </div>
    </section>
  );
}

export default Dashboard;
