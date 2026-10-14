import React from "react";
import { useAuth } from "../hooks/useAuth";

function Header() {
  const { user, isAdmin } = useAuth();
  const profileLabel = isAdmin ? "Administrador" : "Funcionário";

  return (
    <header className="header">
      <h2 className="header-brand-title">Essencial Cosméticos</h2>

      <div className="header-user">
        <strong>{user?.name || "Usuário"}</strong>
        <p className="muted">Perfil: {profileLabel}</p>
      </div>
    </header>
  );
}

export default Header;
