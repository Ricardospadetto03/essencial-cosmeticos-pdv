import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AppIcon from "./AppIcon";

const MENU_ITEMS = [
  { to: "/dashboard", label: "Início", icon: "dashboard" },
  { to: "/products", label: "Produtos", icon: "products", adminOnly: true },
  { to: "/sales", label: "Vendas", icon: "sales" },
  { to: "/stock", label: "Estoque", icon: "stock" },
  { to: "/users", label: "Usuários", icon: "users", adminOnly: true },
  { to: "/reports", label: "Relatórios", icon: "reports", adminOnly: true },
  { to: "/backup", label: "Backup", icon: "backup", adminOnly: true },
];

function Sidebar() {
  const [logoVisible, setLogoVisible] = useState(true);
  const { user, isAdmin, logout } = useAuth();

  const visibleItems = MENU_ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        {logoVisible ? (
          <img
            src="/logo-essencial.png"
            alt="Logo Essencial Cosméticos"
            onError={() => setLogoVisible(false)}
          />
        ) : (
          <div className="auth-logo-fallback">EC</div>
        )}
      </div>

      <div className="sidebar-user-box">
        <p className="sidebar-user-name">Olá, {user?.name || "Usuário"}</p>
        <p className="sidebar-user-role">{isAdmin ? "Administrador" : "Funcionário"}</p>
      </div>

      <nav className="menu-list">
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="menu-link">
            <span className="menu-link-icon">
              <AppIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="menu-link menu-link-button menu-link-logout" onClick={logout}>
          <span className="menu-link-icon">
            <AppIcon name="logout" />
          </span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
